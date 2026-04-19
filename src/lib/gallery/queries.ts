import type { SupabaseClient } from "@supabase/supabase-js";

import type { FolderRow } from "@/types/folder";
import {
  GALLERY_BUCKET_NAME,
  type GalleryScope,
  type GallerySortOrder,
  type GalleryViewMode,
} from "@/types/gallery";
import type { GalleryImageItem, ImageRow } from "@/types/image";

type SearchParamsValue = string | string[] | undefined;
type SearchParamsShape = Record<string, SearchParamsValue>;

export function parseGalleryScope(searchParams: SearchParamsShape): GalleryScope {
  const rawScope = takeFirst(searchParams.scope);
  const folderId = takeFirst(searchParams.folderId);

  if (rawScope === "uncategorized") {
    return { type: "uncategorized" };
  }

  if (rawScope === "favorites") {
    return { type: "favorites" };
  }

  if (rawScope === "folder" && folderId) {
    return { type: "folder", folderId };
  }

  return { type: "all" };
}

export function parseGallerySort(searchParams: SearchParamsShape): GallerySortOrder {
  const rawSort = takeFirst(searchParams.sort);
  return rawSort === "oldest" ? "oldest" : "newest";
}

export function parseGalleryView(searchParams: SearchParamsShape): GalleryViewMode {
  const rawView = takeFirst(searchParams.view);
  return rawView === "list" ? "list" : "grid";
}

export async function listFolders(supabase: SupabaseClient, userId: string): Promise<FolderRow[]> {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "フォルダー一覧を取得できませんでした。");
  }

  return (data ?? []) as FolderRow[];
}

export async function listImages(
  supabase: SupabaseClient,
  userId: string,
  scope: GalleryScope,
  sort: GallerySortOrder,
  folders: FolderRow[],
): Promise<GalleryImageItem[]> {
  let query = supabase.from("images").select("*").eq("user_id", userId);

  if (scope.type === "uncategorized") {
    query = query.is("folder_id", null);
  }

  if (scope.type === "favorites") {
    query = query.eq("is_favorite", true);
  }

  if (scope.type === "folder" && scope.folderId) {
    query = query.eq("folder_id", scope.folderId);
  }

  const { data, error } = await query.order("created_at", { ascending: sort === "oldest" });

  if (error) {
    throw new Error(error.message || "画像一覧を取得できませんでした。");
  }

  const rows = (data ?? []) as ImageRow[];

  if (rows.length === 0) {
    return [];
  }

  const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
  const { data: signedUrls, error: signedUrlsError } = await supabase.storage
    .from(GALLERY_BUCKET_NAME)
    .createSignedUrls(rows.map((row) => row.storage_path), 60 * 60);

  const signedMap = new Map(
    ((signedUrlsError ? [] : signedUrls) ?? []).map((item) => [
      item.path,
      item.error ? null : item.signedUrl,
    ]),
  );

  return rows.map((row) => ({
    ...row,
    signed_url: signedMap.get(row.storage_path) ?? null,
    folder_name: row.folder_id ? folderMap.get(row.folder_id) ?? null : null,
  }));
}

function takeFirst(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
