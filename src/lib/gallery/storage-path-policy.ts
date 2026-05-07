const DERIVATIVE_PATH_KINDS = new Set(["thumbnails", "display", "originals"]);

export function getStoragePathOwnerId(path: string) {
  const segments = path.split("/").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  if (DERIVATIVE_PATH_KINDS.has(segments[0])) {
    return segments[1] ?? null;
  }

  return segments[0] ?? null;
}

export function isAllowedGalleryStoragePath(path: string, userId: string) {
  return getStoragePathOwnerId(path) === userId;
}
