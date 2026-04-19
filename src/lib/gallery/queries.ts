import type { SupabaseClient } from "@supabase/supabase-js";

import type { FolderRow } from "@/types/folder";
import {
  GALLERY_BUCKET_NAME,
  GALLERY_PAGE_SIZE,
  type GalleryPagination,
  type GalleryScope,
  type GallerySortOrder,
  type GalleryViewMode,
} from "@/types/gallery";
import type { GalleryImageItem, ImageRow } from "@/types/image";

type SearchParamsValue = string | string[] | undefined;
type SearchParamsShape = Record<string, SearchParamsValue>;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const GALLERY_THUMBNAIL_TRANSFORM = {
  width: 640,
  height: 512,
  resize: "cover" as const,
  quality: 70,
};

function buildImagesQuery(
  supabase: SupabaseClient,
  userId: string,
  scope: GalleryScope,
) {
  let query = supabase.from("images").select("*", { count: "exact" }).eq("user_id", userId);

  if (scope.type === "uncategorized") {
    query = query.is("folder_id", null);
  }

  if (scope.type === "favorites") {
    query = query.eq("is_favorite", true);
  }

  if (scope.type === "folder" && scope.folderId) {
    query = query.eq("folder_id", scope.folderId);
  }

  return query;
}

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

export function parseGalleryPage(searchParams: SearchParamsShape): number {
  const rawPage = Number.parseInt(takeFirst(searchParams.page) ?? "1", 10);

  if (!Number.isFinite(rawPage) || rawPage < 1) {
    return 1;
  }

  return rawPage;
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
  page: number,
): Promise<{ images: GalleryImageItem[]; pagination: GalleryPagination }> {
  const ascending = sort === "oldest";
  const start = (page - 1) * GALLERY_PAGE_SIZE;
  const end = start + GALLERY_PAGE_SIZE - 1;
  const { data, error, count } = await buildImagesQuery(supabase, userId, scope)
    .order("created_at", { ascending })
    .range(start, end);

  if (error) {
    throw new Error(error.message || "画像一覧を取得できませんでした。");
  }

  const totalCount = count ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / GALLERY_PAGE_SIZE) : 1;
  const safePage = Math.min(page, totalPages);
  let rows = (data ?? []) as ImageRow[];

  if (safePage !== page && totalCount > 0) {
    const safeStart = (safePage - 1) * GALLERY_PAGE_SIZE;
    const safeEnd = safeStart + GALLERY_PAGE_SIZE - 1;
    const { data: safeData, error: safeError } = await buildImagesQuery(supabase, userId, scope)
      .order("created_at", { ascending })
      .range(safeStart, safeEnd);

    if (safeError) {
      throw new Error(safeError.message || "画像一覧を取得できませんでした。");
    }

    rows = (safeData ?? []) as ImageRow[];
  }

  const pagination = {
    page: safePage,
    pageSize: GALLERY_PAGE_SIZE,
    totalCount,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  } satisfies GalleryPagination;

  if (rows.length === 0) {
    return {
      images: [],
      pagination,
    };
  }

  const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
  const storage = supabase.storage.from(GALLERY_BUCKET_NAME);
  const [{ data: signedUrls, error: signedUrlsError }, thumbnailResults] = await Promise.all([
    storage.createSignedUrls(
      rows.map((row) => row.storage_path),
      SIGNED_URL_TTL_SECONDS,
    ),
    Promise.all(
      rows.map((row) =>
        storage.createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS, {
          transform: GALLERY_THUMBNAIL_TRANSFORM,
        }),
      ),
    ),
  ]);

  const signedMap = new Map(
    ((signedUrlsError ? [] : signedUrls) ?? []).map((item) => [
      item.path,
      item.error ? null : item.signedUrl,
    ]),
  );
  const thumbnailMap = new Map(
    rows.map((row, index) => [
      row.storage_path,
      thumbnailResults[index]?.error ? null : thumbnailResults[index]?.data?.signedUrl ?? null,
    ]),
  );

  return {
    images: rows.map((row) => ({
      ...row,
      signed_url: signedMap.get(row.storage_path) ?? null,
      thumbnail_url: thumbnailMap.get(row.storage_path) ?? null,
      folder_name: row.folder_id ? folderMap.get(row.folder_id) ?? null : null,
    })),
    pagination,
  };
}

function takeFirst(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
