import type { SupabaseClient } from "@supabase/supabase-js";

import { GALLERY_BUCKET_NAME } from "@/types/gallery";

function ensureTrimmedName(name: string, resourceName: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error(`${resourceName}名を入力してください。`);
  }

  return trimmedName;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function createFolder(supabase: SupabaseClient, name: string) {
  const trimmedName = ensureTrimmedName(name, "フォルダー");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログイン状態を確認できませんでした。");
  }

  const { error } = await supabase.from("folders").insert({
    user_id: user.id,
    name: trimmedName,
  });

  if (error) {
    throw new Error(error.message || "フォルダーを作成できませんでした。");
  }
}

export async function renameFolder(supabase: SupabaseClient, id: string, name: string) {
  const trimmedName = ensureTrimmedName(name, "フォルダー");

  const { error } = await supabase
    .from("folders")
    .update({
      name: trimmedName,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "フォルダー名を変更できませんでした。");
  }
}

export async function deleteFolder(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("folders").delete().eq("id", id);

  if (error) {
    throw new Error(error.message || "フォルダーを削除できませんでした。");
  }
}

export async function touchFolder(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .from("folders")
    .update({
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "フォルダーの利用日時を更新できませんでした。");
  }
}

export async function toggleFavorite(supabase: SupabaseClient, id: string, nextValue: boolean) {
  const { error } = await supabase
    .from("images")
    .update({
      is_favorite: nextValue,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "お気に入り状態を更新できませんでした。");
  }
}

export async function setImagesFavorite(
  supabase: SupabaseClient,
  imageIds: string[],
  nextValue: boolean,
) {
  if (imageIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("images")
    .update({
      is_favorite: nextValue,
    })
    .in("id", imageIds);

  if (error) {
    throw new Error(error.message || "一括お気に入り更新に失敗しました。");
  }
}

export async function renameImage(supabase: SupabaseClient, id: string, fileName: string) {
  const trimmedName = ensureTrimmedName(fileName, "画像");

  const { error } = await supabase
    .from("images")
    .update({
      file_name: trimmedName,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "画像名を変更できませんでした。");
  }

  return trimmedName;
}

export async function moveImageToFolder(
  supabase: SupabaseClient,
  imageId: string,
  folderId: string | null,
) {
  const { error } = await supabase
    .from("images")
    .update({
      folder_id: folderId,
    })
    .eq("id", imageId);

  if (error) {
    throw new Error(error.message || "フォルダー移動に失敗しました。");
  }
}

export async function moveImagesToFolder(
  supabase: SupabaseClient,
  imageIds: string[],
  folderId: string | null,
) {
  if (imageIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("images")
    .update({
      folder_id: folderId,
    })
    .in("id", imageIds);

  if (error) {
    throw new Error(error.message || "一括フォルダー移動に失敗しました。");
  }
}

type ImageDeleteTarget = {
  id: string;
  storage_path: string;
};

async function deleteImageRecords(supabase: SupabaseClient, imageIds: string[]) {
  if (imageIds.length === 0) {
    return;
  }

  const { error } = await supabase.from("images").delete().in("id", imageIds);

  if (error) {
    throw new Error(error.message || "画像の削除に失敗しました。");
  }
}

export async function deleteImagesWithStorage(
  supabase: SupabaseClient,
  images: ImageDeleteTarget[],
) {
  if (images.length === 0) {
    return;
  }

  const storagePaths = images.map((image) => image.storage_path);
  const imageIds = images.map((image) => image.id);
  const { error: storageError } = await supabase.storage.from(GALLERY_BUCKET_NAME).remove(storagePaths);

  if (storageError) {
    throw new Error(storageError.message || "Storage から画像を削除できませんでした。");
  }

  try {
    await deleteImageRecords(supabase, imageIds);
  } catch (error) {
    throw new Error(
      `Storage からは削除されましたが、データベース更新に失敗しました。${getErrorMessage(
        error,
        "状態を確認して再試行してください。",
      )}`,
    );
  }
}
