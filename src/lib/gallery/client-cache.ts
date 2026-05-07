import type {
  GalleryPagination,
  GalleryScope,
  GallerySortOrder,
} from "@/types/gallery";
import type { GalleryImageItem } from "@/types/image";

export type CachedGalleryPage = {
  images: GalleryImageItem[];
  pagination: GalleryPagination;
  cachedAt: number;
  lastAccessedAt: number;
};

export const GALLERY_CLIENT_CACHE_TTL_MS = 3 * 60 * 1000;
export const GALLERY_CLIENT_CACHE_MAX_ENTRIES = 24;

const galleryPageCache = new Map<string, CachedGalleryPage>();

export function createGalleryDataKey(
  userId: string,
  scope: GalleryScope,
  sort: GallerySortOrder,
  page: number,
) {
  return [
    userId,
    scope.type,
    scope.type === "folder" ? scope.folderId ?? "" : "",
    sort,
    page,
  ].join(":");
}

export function getCachedGalleryPage(key: string, now = Date.now()) {
  const cached = galleryPageCache.get(key);

  if (!cached) {
    return null;
  }

  if (now - cached.cachedAt > GALLERY_CLIENT_CACHE_TTL_MS) {
    galleryPageCache.delete(key);
    return null;
  }

  cached.lastAccessedAt = now;
  return cached;
}

export function setCachedGalleryPage(
  key: string,
  images: GalleryImageItem[],
  pagination: GalleryPagination,
  now = Date.now(),
) {
  galleryPageCache.set(key, {
    images,
    pagination,
    cachedAt: now,
    lastAccessedAt: now,
  });
  pruneGalleryPageCache(now);
}

export function clearGalleryPageCache() {
  galleryPageCache.clear();
}

export function clearGalleryPageCacheForUser(userId: string) {
  for (const key of galleryPageCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      galleryPageCache.delete(key);
    }
  }
}

export function getGalleryPageCacheSize() {
  return galleryPageCache.size;
}

function pruneGalleryPageCache(now: number) {
  for (const [key, cached] of galleryPageCache) {
    if (now - cached.cachedAt > GALLERY_CLIENT_CACHE_TTL_MS) {
      galleryPageCache.delete(key);
    }
  }

  while (galleryPageCache.size > GALLERY_CLIENT_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAccessedAt = Number.POSITIVE_INFINITY;

    for (const [key, cached] of galleryPageCache) {
      if (cached.lastAccessedAt < oldestAccessedAt) {
        oldestKey = key;
        oldestAccessedAt = cached.lastAccessedAt;
      }
    }

    if (!oldestKey) {
      return;
    }

    galleryPageCache.delete(oldestKey);
  }
}
