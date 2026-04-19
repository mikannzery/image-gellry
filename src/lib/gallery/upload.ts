import type { SupabaseClient } from "@supabase/supabase-js";

import { touchFolder } from "@/lib/gallery/mutations";
import {
  buildStoragePath,
  getImageMetadata,
  isSupportedImageType,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/utils/image";
import type { GalleryScope, UploadImageInput, UploadImageResult } from "@/types/gallery";
import { GALLERY_BUCKET_NAME } from "@/types/gallery";

export async function uploadImages(
  supabase: SupabaseClient,
  input: UploadImageInput,
): Promise<UploadImageResult[]> {
  const results: UploadImageResult[] = [];

  for (const file of input.files) {
    try {
      validateFile(file);

      const metadata = await getImageMetadata(file);
      const storagePath = buildStoragePath(input.userId, file.name);
      const targetFolderId = resolveFolderId(input.scope);

      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET_NAME)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Storage への保存に失敗しました。");
      }

      const { data: inserted, error: insertError } = await supabase
        .from("images")
        .insert({
          user_id: input.userId,
          folder_id: targetFolderId,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
          width: metadata.width,
          height: metadata.height,
          is_favorite: false,
        })
        .select("id")
        .single();

      if (insertError) {
        await supabase.storage.from(GALLERY_BUCKET_NAME).remove([storagePath]);
        throw new Error(insertError.message || "画像レコードを作成できませんでした。");
      }

      if (targetFolderId) {
        await touchFolder(supabase, targetFolderId);
      }

      results.push({
        fileName: file.name,
        status: "success",
        imageId: inserted.id,
      });
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
}
