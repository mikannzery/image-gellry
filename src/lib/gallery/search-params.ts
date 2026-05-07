import type { GalleryScope, GallerySortOrder, GalleryViewMode } from "@/types/gallery";

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

export function parseGalleryPage(searchParams: SearchParamsShape): number {
  const rawPage = Number.parseInt(takeFirst(searchParams.page) ?? "1", 10);

  if (!Number.isFinite(rawPage) || rawPage < 1) {
    return 1;
  }

  return rawPage;
}

function takeFirst(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
