import type { SupabaseClient } from "@supabase/supabase-js";

import { touchFolder } from "@/lib/gallery/mutations";
import {
  assertImageCompressionSupported,
  buildVariantStoragePath,
  generateCompressedImageAsset,
  getFileExtension,
  isSupportedImageType,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/utils/image";
import {
  GALLERY_BUCKET_NAME,
  GALLERY_DISPLAY_MAX_EDGE,
  GALLERY_DISPLAY_QUALITY,
  GALLERY_SAVE_ORIGINAL,
  GALLERY_THUMBNAIL_MAX_EDGE,
  GALLERY_THUMBNAIL_QUALITY,
  type GalleryScope,
  type UploadImageInput,
  type UploadImageResult,
} from "@/types/gallery";

type UploadedAsset = {
  path: string;
};

export async function uploadImages(
  supabase: SupabaseClient,
  input: UploadImageInput,
): Promise<UploadImageResult[]> {
  const results: UploadImageResult[] = [];

  for (const file of input.files) {
    try {
      validateFile(file);

      const targetFolderId = resolveFolderId(input.scope);
      const imageId = crypto.randomUUID();
      const thumbnailAsset = await generateCompressedImageAsset(file, {
        fileName: file.name,
        maxLongEdge: GALLERY_THUMBNAIL_MAX_EDGE,
        quality: GALLERY_THUMBNAIL_QUALITY,
      });
      const displayAsset = await generateCompressedImageAsset(file, {
        fileName: file.name,
        maxLongEdge: GALLERY_DISPLAY_MAX_EDGE,
        quality: GALLERY_DISPLAY_QUALITY,
      });
      const thumbnailPath = buildVariantStoragePath("thumbnails", input.userId, imageId, "webp");
      const displayPath = buildVariantStoragePath("display", input.userId, imageId, "webp");
      const originalPath = GALLERY_SAVE_ORIGINAL
        ? buildVariantStoragePath("originals", input.userId, imageId, getFileExtension(file.name, "bin"))
        : null;
      const uploadedAssets: UploadedAsset[] = [];

      try {
        await uploadAsset(supabase, thumbnailPath, thumbnailAsset.blob, thumbnailAsset.mimeType);
        uploadedAssets.push({ path: thumbnailPath });

        await uploadAsset(supabase, displayPath, displayAsset.blob, displayAsset.mimeType);
        uploadedAssets.push({ path: displayPath });

        if (originalPath) {
          await uploadAsset(supabase, originalPath, file, file.type);
          uploadedAssets.push({ path: originalPath });
        }

        const { data: inserted, error: insertError } = await supabase
          .from("images")
          .insert({
            id: imageId,
            user_id: input.userId,
            folder_id: targetFolderId,
            file_name: file.name,
            storage_path: displayPath,
            thumbnail_path: thumbnailPath,
            display_path: displayPath,
            original_path: originalPath,
            mime_type: displayAsset.mimeType,
            size_bytes: displayAsset.sizeBytes,
            width: displayAsset.width,
            height: displayAsset.height,
            is_favorite: false,
          })
          .select("id")
          .single();

        if (insertError) {
          throw new Error(insertError.message || "画像レコードを保存できませんでした。");
        }

        results.push({
          fileName: file.name,
          status: "success",
          imageId: inserted.id,
        });
      } catch (error) {
        await cleanupUploadedAssets(supabase, uploadedAssets);
        throw error;
      }

      if (targetFolderId) {
        void touchFolder(supabase, targetFolderId).catch(() => {
          return;
        });
      }
    } catch (error) {
      results.push({
        fileName: file.name,
        status: "error",
        error: error instanceof Error ? error.message : "アップロードに失敗しました。",
      });
    }
  }

  return results;
}

function resolveFolderId(scope: GalleryScope) {
  return scope.type === "folder" ? scope.folderId ?? null : null;
}

function validateFile(file: File) {
  if (!isSupportedImageType(file.type)) {
    throw new Error("png / jpg / jpeg / webp のみアップロードできます。");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("1ファイル20MBまでアップロードできます。");
  }

  assertImageCompressionSupported();
}

async function uploadAsset(
  supabase: SupabaseClient,
  path: string,
  file: Blob,
  contentType: string,
) {
  const { error } = await supabase.storage.from(GALLERY_BUCKET_NAME).upload(path, file, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Storage への保存に失敗しました。");
  }
}

async function cleanupUploadedAssets(
  supabase: SupabaseClient,
  uploadedAssets: UploadedAsset[],
) {
  if (uploadedAssets.length === 0) {
    return;
  }

  await supabase.storage
    .from(GALLERY_BUCKET_NAME)
    .remove(uploadedAssets.map((asset) => asset.path));
}
