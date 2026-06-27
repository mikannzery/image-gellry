import type { SupabaseClient } from "@supabase/supabase-js";

import type { FolderRow } from "@/types/folder";
export {
  parseGalleryPage,
  parseGalleryScope,
  parseGallerySort,
  parseGalleryView,
} from "@/lib/gallery/search-params";
import {
  GALLERY_BUCKET_NAME,
  GALLERY_PAGE_SIZE,
  type GalleryPagination,
  type GalleryScope,
  type GallerySortOrder,
} from "@/types/gallery";
import type { GalleryImageItem, ImageRow } from "@/types/image";

type StorageSignedUrlEntry = {
  path: string;
  signedUrl: string | null;
};

type ImageRowsPage = {
  rows: ImageRow[];
  pagination: GalleryPagination;
  queryStart: number;
};

type GalleryQueryContext = {
  scope: GalleryScope;
  sort: GallerySortOrder;
  page: number;
  queryStart: number;
  signedUrlExpiresIn: number;
  knownImagesById?: ReadonlyMap<string, GalleryImageItem>;
};

const SIGNED_URL_TTL_SECONDS = parseSignedUrlExpiresIn(process.env.GALLERY_SIGNED_URL_EXPIRES_IN);
const LEGACY_THUMBNAIL_TRANSFORM = {
  width: 640,
  height: 512,
  resize: "cover" as const,
  quality: 70,
};

function buildImagesQuery(supabase: SupabaseClient, userId: string, scope: GalleryScope) {
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
  signedUrlExpiresIn = SIGNED_URL_TTL_SECONDS,
  knownImagesById?: ReadonlyMap<string, GalleryImageItem>,
): Promise<{ images: GalleryImageItem[]; pagination: GalleryPagination }> {
  const { rows, pagination, queryStart } = await listImageRows(supabase, userId, scope, sort, page);

  return {
    images: await buildGalleryImageItems(supabase, rows, folders, {
      scope,
      sort,
      page: pagination.page,
      queryStart,
      signedUrlExpiresIn,
      knownImagesById,
    }),
    pagination,
  };
}

export async function listGalleryData(
  supabase: SupabaseClient,
  userId: string,
  scope: GalleryScope,
  sort: GallerySortOrder,
  page: number,
): Promise<{ folders: FolderRow[]; images: GalleryImageItem[]; pagination: GalleryPagination }> {
  const foldersPromise = listFolders(supabase, userId);
  const imageRowsPromise = listImageRows(supabase, userId, scope, sort, page);
  const [folders, imageRowsPage] = await Promise.all([foldersPromise, imageRowsPromise]);

  return {
    folders,
    images: await buildGalleryImageItems(supabase, imageRowsPage.rows, folders, {
      scope,
      sort,
      page: imageRowsPage.pagination.page,
      queryStart: imageRowsPage.queryStart,
      signedUrlExpiresIn: SIGNED_URL_TTL_SECONDS,
    }),
    pagination: imageRowsPage.pagination,
  };
}

async function listImageRows(
  supabase: SupabaseClient,
  userId: string,
  scope: GalleryScope,
  sort: GallerySortOrder,
  page: number,
): Promise<ImageRowsPage> {
  const queryStart = Date.now();
  const ascending = sort === "oldest";
  const start = (page - 1) * GALLERY_PAGE_SIZE;
  const end = start + GALLERY_PAGE_SIZE - 1;
  debugGalleryQuery("start", {
    scope: scope.type,
    folderId: scope.type === "folder" ? scope.folderId ?? null : null,
    sort,
    page,
  });
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

  return {
    rows,
    pagination,
    queryStart,
  };
}

async function buildGalleryImageItems(
  supabase: SupabaseClient,
  rows: ImageRow[],
  folders: FolderRow[],
  context: GalleryQueryContext,
): Promise<GalleryImageItem[]> {
  const { scope, sort, page, queryStart, signedUrlExpiresIn, knownImagesById } = context;

  if (rows.length === 0) {
    debugGalleryQuery("end", {
      scope: scope.type,
      folderId: scope.type === "folder" ? scope.folderId ?? null : null,
      sort,
      page,
      rows: 0,
      signedUrlCount: 0,
      elapsedMs: Date.now() - queryStart,
    });
    return [];
  }

  const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
  const storage = supabase.storage.from(GALLERY_BUCKET_NAME);
  const knownDisplayUrls = new Map<string, string>();
  const knownThumbnailUrls = new Map<string, string>();
  const knownLegacyThumbnailUrls = new Map<string, string>();

  for (const row of rows) {
    const knownImage = knownImagesById?.get(row.id);
    const displayPath = row.display_path ?? row.storage_path;

    if (
      knownImage?.display_url &&
      (knownImage.display_path ?? knownImage.storage_path) === displayPath
    ) {
      knownDisplayUrls.set(displayPath, knownImage.display_url);
    }

    if (
      knownImage?.thumbnail_url &&
      knownImage.thumbnail_path === row.thumbnail_path &&
      row.thumbnail_path
    ) {
      knownThumbnailUrls.set(row.thumbnail_path, knownImage.thumbnail_url);
    }

    if (
      knownImage?.thumbnail_url &&
      !knownImage.thumbnail_path &&
      !row.thumbnail_path &&
      (knownImage.display_path ?? knownImage.storage_path) === displayPath
    ) {
      knownLegacyThumbnailUrls.set(displayPath, knownImage.thumbnail_url);
    }
  }

  const displayPaths = Array.from(
    new Set(
      rows
        .map((row) => row.display_path ?? row.storage_path)
        .filter((path) => Boolean(path) && !knownDisplayUrls.has(path)),
    ),
  );
  const thumbnailPaths = Array.from(
    new Set(
      rows
        .map((row) => row.thumbnail_path)
        .filter(
          (path): path is string => Boolean(path) && !knownThumbnailUrls.has(path as string),
        ),
    ),
  );
  const legacyRows = rows.filter((row) => {
    if (row.thumbnail_path) {
      return false;
    }

    const displayPath = row.display_path ?? row.storage_path;
    return !knownLegacyThumbnailUrls.has(displayPath) && !knownDisplayUrls.has(displayPath);
  });
  debugGalleryQuery("signed-url-start", {
    scope: scope.type,
    folderId: scope.type === "folder" ? scope.folderId ?? null : null,
    sort,
    page,
    displayCount: displayPaths.length,
    thumbnailCount: thumbnailPaths.length,
    legacyThumbnailCount: legacyRows.length,
    expiresIn: signedUrlExpiresIn,
  });
  const [{ data: displaySignedUrls, error: displayError }, { data: thumbnailSignedUrls, error: thumbnailError }] =
    await Promise.all([
      displayPaths.length > 0
        ? storage.createSignedUrls(displayPaths, signedUrlExpiresIn)
        : Promise.resolve({ data: [], error: null }),
      thumbnailPaths.length > 0
        ? storage.createSignedUrls(thumbnailPaths, signedUrlExpiresIn)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const legacyThumbnailResults = await Promise.all(
    legacyRows.map(async (row) => {
      const basePath = row.display_path ?? row.storage_path;
      const { data: transformedData, error: transformedError } = await storage.createSignedUrl(
        basePath,
        signedUrlExpiresIn,
        {
          transform: LEGACY_THUMBNAIL_TRANSFORM,
        },
      );

      return {
        path: basePath,
        signedUrl: transformedError ? null : transformedData?.signedUrl ?? null,
      } satisfies StorageSignedUrlEntry;
    }),
  );

  const displayMap = new Map([
    ...knownDisplayUrls,
    ...createSignedUrlMap(displayError ? [] : displaySignedUrls ?? []),
  ]);
  const thumbnailMap = new Map([
    ...knownThumbnailUrls,
    ...createSignedUrlMap(thumbnailError ? [] : thumbnailSignedUrls ?? []),
  ]);
  const legacyThumbnailMap = new Map(
    legacyThumbnailResults.map((entry) => [entry.path, entry.signedUrl] as const),
  );
  debugGalleryQuery("end", {
    scope: scope.type,
    folderId: scope.type === "folder" ? scope.folderId ?? null : null,
    sort,
    page,
    rows: rows.length,
    displayCount: displayPaths.length,
    thumbnailCount: thumbnailPaths.length,
    legacyThumbnailCount: legacyRows.length,
    elapsedMs: Date.now() - queryStart,
  });

  return rows.map((row) => {
    const displayPath = row.display_path ?? row.storage_path;
    const thumbnailUrl =
      (row.thumbnail_path ? thumbnailMap.get(row.thumbnail_path) : null) ??
      knownLegacyThumbnailUrls.get(displayPath) ??
      legacyThumbnailMap.get(displayPath) ??
      displayMap.get(displayPath) ??
      null;

    return {
      ...row,
      display_url: displayMap.get(displayPath) ?? null,
      thumbnail_url: thumbnailUrl,
      folder_name: row.folder_id ? folderMap.get(row.folder_id) ?? null : null,
      requires_derivatives: !row.thumbnail_path || !row.display_path,
    } satisfies GalleryImageItem;
  });
}

function createSignedUrlMap(
  entries: { path: string | null; signedUrl: string | null; error?: string | null }[],
) {
  return new Map(
    entries
      .filter((entry): entry is { path: string; signedUrl: string | null; error?: string | null } =>
        Boolean(entry.path),
      )
      .map((entry) => [entry.path, entry.error ? null : entry.signedUrl] as const),
  );
}

function parseSignedUrlExpiresIn(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 60) {
    return 60 * 60 * 6;
  }

  return parsed;
}

export function getGallerySignedUrlExpiresIn() {
  return SIGNED_URL_TTL_SECONDS;
}

function debugGalleryQuery(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug(`[gallery-query] ${message}`, details);
}
