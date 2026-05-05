import type { FolderRow } from "@/types/folder";

export const GALLERY_BUCKET_NAME = "gallery-images";
export const GALLERY_PAGE_SIZE = 32;
export const GALLERY_THUMBNAIL_MAX_EDGE = 480;
export const GALLERY_THUMBNAIL_QUALITY = 0.75;
export const GALLERY_DISPLAY_MAX_EDGE = 1600;
export const GALLERY_DISPLAY_QUALITY = 0.82;
export const GALLERY_SAVE_ORIGINAL =
  process.env.NEXT_PUBLIC_GALLERY_SAVE_ORIGINAL?.toLowerCase() === "true";
export const GALLERY_SCOPE_TYPES = ["all", "uncategorized", "favorites", "folder"] as const;
export const GALLERY_VIEW_MODES = ["grid", "list"] as const;
export const GALLERY_SORT_ORDERS = ["newest", "oldest"] as const;

export type GalleryScopeType = (typeof GALLERY_SCOPE_TYPES)[number];
export type GalleryViewMode = (typeof GALLERY_VIEW_MODES)[number];
export type GallerySortOrder = (typeof GALLERY_SORT_ORDERS)[number];

export type GalleryScope = {
  type: GalleryScopeType;
  folderId?: string;
};

export type GalleryFilters = {
  scope: GalleryScope;
  view: GalleryViewMode;
  sort: GallerySortOrder;
  page: number;
};

export type GalleryPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type UploadImageInput = {
  userId: string;
  scope: GalleryScope;
  files: File[];
};

export type UploadImageResult = {
  fileName: string;
  status: "success" | "error";
  imageId?: string;
  error?: string;
};

export function getGalleryTitle(scope: GalleryScope, folders: FolderRow[]): string {
  if (scope.type === "all") {
    return "すべての画像";
  }

  if (scope.type === "uncategorized") {
    return "未分類";
  }

  if (scope.type === "favorites") {
    return "お気に入り";
  }

  const folder = folders.find((item) => item.id === scope.folderId);
  return folder?.name ?? "フォルダー";
}
