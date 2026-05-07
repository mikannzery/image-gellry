import assert from "node:assert/strict";

import {
  clearGalleryPageCache,
  createGalleryDataKey,
  getCachedGalleryPage,
  getGalleryPageCacheSize,
  setCachedGalleryPage,
  GALLERY_CLIENT_CACHE_MAX_ENTRIES,
  GALLERY_CLIENT_CACHE_TTL_MS,
} from "../src/lib/gallery/client-cache";
import {
  getStoragePathOwnerId,
  isAllowedGalleryStoragePath,
} from "../src/lib/gallery/storage-path-policy";
import {
  parseGalleryPage,
  parseGalleryScope,
  parseGallerySort,
  parseGalleryView,
} from "../src/lib/gallery/search-params";
import type { GalleryPagination } from "../src/types/gallery";
import type { GalleryImageItem } from "../src/types/image";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: "gallery search params fall back safely",
    run() {
      assert.deepEqual(parseGalleryScope({ scope: "folder" }), { type: "all" });
      assert.deepEqual(parseGalleryScope({ scope: "folder", folderId: "folder-1" }), {
        type: "folder",
        folderId: "folder-1",
      });
      assert.equal(parseGallerySort({ sort: "oldest" }), "oldest");
      assert.equal(parseGallerySort({ sort: "unknown" }), "newest");
      assert.equal(parseGalleryView({ view: "list" }), "list");
      assert.equal(parseGalleryView({ view: "wide" }), "grid");
      assert.equal(parseGalleryPage({ page: "0" }), 1);
      assert.equal(parseGalleryPage({ page: "12" }), 12);
    },
  },
  {
    name: "gallery cache excludes view and prunes old entries",
    run() {
      clearGalleryPageCache();

      const pagination = createPagination();
      const firstKey = createGalleryDataKey("user-1", { type: "all" }, "newest", 1);

      setCachedGalleryPage(firstKey, [createImage("image-1")], pagination, 1000);
      assert.equal(getCachedGalleryPage(firstKey, 1001)?.images[0]?.id, "image-1");
      assert.equal(getCachedGalleryPage(firstKey, 1000 + GALLERY_CLIENT_CACHE_TTL_MS + 1), null);

      for (let index = 0; index < GALLERY_CLIENT_CACHE_MAX_ENTRIES + 4; index += 1) {
        const key = createGalleryDataKey("user-1", { type: "all" }, "newest", index + 1);
        setCachedGalleryPage(key, [createImage(`image-${index}`)], pagination, 2000 + index);
      }

      assert.equal(getGalleryPageCacheSize(), GALLERY_CLIENT_CACHE_MAX_ENTRIES);
      assert.equal(getCachedGalleryPage(createGalleryDataKey("user-1", { type: "all" }, "newest", 1), 3000), null);

      clearGalleryPageCache();
    },
  },
  {
    name: "storage path owner policy accepts legacy and derivative paths only by owner",
    run() {
      assert.equal(getStoragePathOwnerId("user-1/image.webp"), "user-1");
      assert.equal(getStoragePathOwnerId("thumbnails/user-1/image.webp"), "user-1");
      assert.equal(getStoragePathOwnerId("display/user-1/image.webp"), "user-1");
      assert.equal(getStoragePathOwnerId("originals/user-1/image.png"), "user-1");
      assert.equal(isAllowedGalleryStoragePath("thumbnails/user-1/image.webp", "user-1"), true);
      assert.equal(isAllowedGalleryStoragePath("thumbnails/user-2/image.webp", "user-1"), false);
      assert.equal(isAllowedGalleryStoragePath("tmp/user-1/image.webp", "user-1"), false);
    },
  },
];

for (const test of tests) {
  test.run();
  console.log(`[test] ok ${test.name}`);
}

function createPagination(): GalleryPagination {
  return {
    page: 1,
    pageSize: 32,
    totalCount: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function createImage(id: string): GalleryImageItem {
  return {
    id,
    user_id: "user-1",
    folder_id: null,
    file_name: `${id}.webp`,
    storage_path: `display/user-1/${id}.webp`,
    thumbnail_path: `thumbnails/user-1/${id}.webp`,
    display_path: `display/user-1/${id}.webp`,
    original_path: null,
    mime_type: "image/webp",
    size_bytes: 100,
    width: 10,
    height: 10,
    is_favorite: false,
    created_at: "2026-05-07T00:00:00.000Z",
    updated_at: "2026-05-07T00:00:00.000Z",
    thumbnail_url: null,
    display_url: null,
    folder_name: null,
    requires_derivatives: false,
  };
}
