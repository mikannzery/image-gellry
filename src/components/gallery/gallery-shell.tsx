"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ImageGrid } from "@/components/gallery/image-grid";
import { ImageList } from "@/components/gallery/image-list";
import { GalleryPaginationControls } from "@/components/gallery/gallery-pagination-controls";
import { SelectionToolbar } from "@/components/gallery/selection-toolbar";
import { CreateFolderModal } from "@/components/folders/create-folder-modal";
import { EditFolderModal } from "@/components/folders/edit-folder-modal";
import { GalleryHeader } from "@/components/layout/gallery-header";
import { Sidebar } from "@/components/layout/sidebar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ToastStack, type ToastItem } from "@/components/shared/toast";
import { ClipboardPasteZone } from "@/components/upload/clipboard-paste-zone";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { FullscreenViewer } from "@/components/viewer/fullscreen-viewer";
import { ImageDetailModal } from "@/components/viewer/image-detail-modal";
import {
  clearGalleryPageCache,
  clearGalleryPageCacheForUser,
  createGalleryDataKey,
  getCachedGalleryPage,
  setCachedGalleryPage,
} from "@/lib/gallery/client-cache";
import {
  createFolder,
  deleteImagesWithStorage,
  deleteFolder,
  moveImageToFolder,
  moveImagesToFolder,
  renameFolder,
  renameImage,
  setImagesFavorite,
  toggleFavorite,
  touchFolder,
} from "@/lib/gallery/mutations";
import { uploadImages } from "@/lib/gallery/upload";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import {
  getGalleryTitle,
  type GalleryFilters,
  type GalleryPagination,
  type GalleryScope,
  type GallerySortOrder,
  type GalleryViewMode,
} from "@/types/gallery";
import type { FolderRow } from "@/types/folder";
import type { GalleryImageItem, ViewerState } from "@/types/image";

type GalleryShellProps = {
  userId: string;
  userEmail: string;
  folders: FolderRow[];
  images: GalleryImageItem[];
  pagination: GalleryPagination;
  initialFilters: GalleryFilters;
};

type PendingAction =
  | "create-folder"
  | "rename-folder"
  | "delete-folder"
  | "rename-image"
  | "move-image"
  | "delete-image"
  | "favorite-image"
  | "bulk-delete"
  | "bulk-move"
  | "bulk-favorite";

const pendingMessages: Record<PendingAction, string> = {
  "create-folder": "フォルダーを作成しています...",
  "rename-folder": "フォルダー名を保存しています...",
  "delete-folder": "フォルダーを削除しています...",
  "rename-image": "画像名を保存しています...",
  "move-image": "画像を移動しています...",
  "delete-image": "画像を削除しています...",
  "favorite-image": "お気に入り状態を更新しています...",
  "bulk-delete": "選択した画像を削除しています...",
  "bulk-move": "選択した画像を移動しています...",
  "bulk-favorite": "選択した画像を更新しています...",
};

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function createGalleryUrl(filters: GalleryFilters) {
  const params = new URLSearchParams();
  params.set("scope", filters.scope.type);
  params.set("sort", filters.sort);
  params.set("view", filters.view);

  if (filters.scope.type === "folder" && filters.scope.folderId) {
    params.set("folderId", filters.scope.folderId);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/gallery?${params.toString()}`;
}

function debugGalleryPerformance(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug(`[gallery] ${message}`, details ?? {});
}

function getEmptyStateCopy(scope: GalleryScope, folders: FolderRow[]) {
  if (scope.type === "all") {
    return {
      title: "まだ画像がありません",
      description:
        "ファイル選択、ドラッグ&ドロップ、貼り付けのいずれかで最初の画像を保存できます。",
      hint: "アップロードした画像は、この画面から一覧・詳細・全画面で見返せます。",
    };
  }

  if (scope.type === "uncategorized") {
    return {
      title: "未分類の画像はありません",
      description: "フォルダー未設定の画像はここに表示されます。あとから別フォルダーへ移動できます。",
      hint: "通常フォルダー以外のカテゴリでアップロードした画像は未分類に保存されます。",
    };
  }

  if (scope.type === "favorites") {
    return {
      title: "お気に入りの画像はありません",
      description: "一覧または詳細モーダルからお気に入りを付けると、このカテゴリに表示されます。",
      hint: "見返したい画像だけをまとめて管理できます。",
    };
  }

  const folderName = folders.find((folder) => folder.id === scope.folderId)?.name ?? "このフォルダー";

  return {
    title: `${folderName} に画像はありません`,
    description: "このフォルダーに直接アップロードするか、別の場所から画像を移動すると表示されます。",
    hint: "フォルダーを削除しても中の画像は消えず、未分類へ移動します。",
  };
}

export function GalleryShell({
  userId,
  userEmail,
  folders,
  images,
  pagination,
  initialFilters,
}: GalleryShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const mutationLockRef = useRef(false);
  const uploadLockRef = useRef(false);
  const fullscreenReturnFocusRef = useRef<HTMLElement | null>(null);
  const toastTimeoutIdsRef = useRef<number[]>([]);
  const lastTouchedFolderIdRef = useRef<string | null>(null);

  const [galleryImages, setGalleryImages] = useState<GalleryImageItem[]>(images);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderRow | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeFilters, setActiveFilters] = useState<GalleryFilters>(initialFilters);
  const [activePagination, setActivePagination] = useState<GalleryPagination>(pagination);
  const [viewerState, setViewerState] = useState<ViewerState>({
    isOpen: false,
    currentIndex: 0,
    images: [],
  });
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectionMoveTargetFolderId, setSelectionMoveTargetFolderId] = useState("");
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const galleryImagesRef = useRef<GalleryImageItem[]>(images);

  const currentFolderId =
    activeFilters.scope.type === "folder" ? activeFilters.scope.folderId ?? null : null;
  const currentTitle = getGalleryTitle(activeFilters.scope, folders);
  const currentPage = activePagination.page;
  const totalPages = activePagination.totalPages;
  const pending = pendingAction !== null || isUploading;
  const pendingMessage = isUploading
    ? "画像をアップロードしています..."
    : pendingAction
      ? pendingMessages[pendingAction]
      : null;
  const folderNameMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const selectedImageIdSet = useMemo(() => new Set(selectedImageIds), [selectedImageIds]);
  const emptyStateCopy = useMemo(
    () => getEmptyStateCopy(activeFilters.scope, folders),
    [activeFilters.scope, folders],
  );

  useEffect(() => {
    const cacheKey = createGalleryDataKey(
      userId,
      initialFilters.scope,
      initialFilters.sort,
      pagination.page,
    );

    setCachedGalleryPage(cacheKey, images, pagination);
    setActiveFilters({ ...initialFilters, page: pagination.page });
    setActivePagination(pagination);
    setGalleryImages(images);
    galleryImagesRef.current = images;
    setSelectedImageIds((current) => {
      const validIds = new Set(images.map((image) => image.id));
      return current.filter((id) => validIds.has(id));
    });
    debugGalleryPerformance("server data applied", {
      key: cacheKey,
      count: images.length,
      page: pagination.page,
    });
  }, [images, initialFilters, pagination, userId]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const rawPage = searchParams.get("page");
    const nextPage = String(activeFilters.page);

    if (rawPage === nextPage || (!rawPage && nextPage === "1")) {
      return;
    }

    window.history.replaceState(null, "", createGalleryUrl(activeFilters));
  }, [activeFilters]);

  useEffect(() => {
    if (!isSelectionMode && selectedImageIds.length > 0) {
      setSelectedImageIds([]);
    }
  }, [isSelectionMode, selectedImageIds.length]);

  useEffect(() => {
    if (selectedImageIds.length === 0) {
      setSelectionMoveTargetFolderId("");
      setIsBulkDeleteConfirmOpen(false);
    }
  }, [selectedImageIds.length]);

  useEffect(() => {
    if (isSelectionMode && galleryImages.length === 0) {
      setIsSelectionMode(false);
      setSelectedImageIds([]);
      setSelectionMoveTargetFolderId("");
      setIsBulkDeleteConfirmOpen(false);
    }
  }, [galleryImages.length, isSelectionMode]);

  useEffect(() => {
    if (!currentFolderId || lastTouchedFolderIdRef.current === currentFolderId) {
      return;
    }

    lastTouchedFolderIdRef.current = currentFolderId;
    void touchFolder(supabase, currentFolderId).catch(() => {});
  }, [currentFolderId, supabase]);

  useEffect(() => {
    return () => {
      toastTimeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeoutIdsRef.current = [];
    };
  }, []);

  const pushToast = useCallback((variant: ToastItem["variant"], message: string) => {
    const nextItem = {
      id: crypto.randomUUID(),
      variant,
      message,
    } satisfies ToastItem;

    setToasts((current) => [...current, nextItem]);
    const timeoutId = window.setTimeout(() => {
      toastTimeoutIdsRef.current = toastTimeoutIdsRef.current.filter((id) => id !== timeoutId);
      setToasts((current) => current.filter((item) => item.id !== nextItem.id));
    }, 3500);
    toastTimeoutIdsRef.current.push(timeoutId);
  }, []);

  const refresh = useCallback(() => {
    clearGalleryPageCache();
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const resetSelectionState = useCallback((nextMode = false) => {
    setIsSelectionMode(nextMode);
    setSelectedImageIds([]);
    setSelectionMoveTargetFolderId("");
    setIsBulkDeleteConfirmOpen(false);
  }, []);

  function navigateWith(
    next: Partial<{
      scope: GalleryScope;
      sort: GallerySortOrder;
      view: GalleryViewMode;
      page: number;
    }>,
  ) {
    if (pending) {
      return;
    }

    const scope = next.scope ?? activeFilters.scope;
    const sort = next.sort ?? activeFilters.sort;
    const view = next.view ?? activeFilters.view;
    const scopeChanged =
      scope.type !== activeFilters.scope.type || scope.folderId !== activeFilters.scope.folderId;
    const sortChanged = sort !== activeFilters.sort;
    const viewChanged = view !== activeFilters.view;
    const page = next.page ?? (scopeChanged || sortChanged ? 1 : activeFilters.page);
    const pageChanged = page !== activeFilters.page;
    const dataChanged = scopeChanged || sortChanged || pageChanged;
    const hasChanged = dataChanged || viewChanged;

    if (!hasChanged) {
      return;
    }

    const nextFilters = { scope, sort, view, page } satisfies GalleryFilters;
    const nextUrl = createGalleryUrl(nextFilters);

    if (viewChanged && !dataChanged) {
      setActiveFilters(nextFilters);
      resetSelectionState(false);
      window.history.replaceState(null, "", nextUrl);
      debugGalleryPerformance("view changed without data query", {
        view,
        scope: scope.type,
        folderId: scope.folderId ?? null,
        sort,
        page,
      });
      return;
    }

    if (hasChanged) {
      if (scopeChanged && (isSelectionMode || selectedImageIds.length > 0)) {
        pushToast("info", "カテゴリを変更したため選択を解除しました。");
      }

      if (dataChanged && viewerState.isOpen) {
        closeViewer();
      }

      resetSelectionState(false);
    }

    if (
      scope.type === "folder" &&
      scope.folderId &&
      (activeFilters.scope.type !== "folder" || activeFilters.scope.folderId !== scope.folderId)
    ) {
      lastTouchedFolderIdRef.current = scope.folderId;
      void touchFolder(supabase, scope.folderId).catch(() => {});
    }

    const cacheKey = createGalleryDataKey(userId, scope, sort, page);
    const cachedPage = getCachedGalleryPage(cacheKey);

    if (cachedPage) {
      setActiveFilters(nextFilters);
      setActivePagination(cachedPage.pagination);
      setGalleryImages(cachedPage.images);
      galleryImagesRef.current = cachedPage.images;
      window.history.pushState(null, "", nextUrl);
      debugGalleryPerformance("cache hit", {
        key: cacheKey,
        count: cachedPage.images.length,
        scope: scope.type,
        folderId: scope.folderId ?? null,
        sort,
        page,
      });
      return;
    }

    debugGalleryPerformance("cache miss, navigating for server query", {
      key: cacheKey,
      scope: scope.type,
      folderId: scope.folderId ?? null,
      sort,
      page,
    });
    router.push(nextUrl);
  }

  function getFolderName(folderId: string | null) {
    if (!folderId) {
      return null;
    }

    return folderNameMap.get(folderId) ?? null;
  }

  const patchGalleryImages = useCallback((
    imageIds: string[],
    updater: (image: GalleryImageItem) => GalleryImageItem,
  ) => {
    const idSet = new Set(imageIds);
    setGalleryImages((current) => {
      const nextImages = current.map((image) => (idSet.has(image.id) ? updater(image) : image));
      galleryImagesRef.current = nextImages;
      return nextImages;
    });
  }, []);

  const removeGalleryImages = useCallback((imageIds: string[]) => {
    const idSet = new Set(imageIds);
    setGalleryImages((current) => {
      const nextImages = current.filter((image) => !idSet.has(image.id));
      galleryImagesRef.current = nextImages;
      return nextImages;
    });
  }, []);

  const patchViewerImages = useCallback((
    imageIds: string[],
    updater: (image: GalleryImageItem) => GalleryImageItem,
  ) => {
    const idSet = new Set(imageIds);
    setViewerState((current) => ({
      ...current,
      images: current.images.map((image) => (idSet.has(image.id) ? updater(image) : image)),
    }));
  }, []);

  const reconcileViewerAfterRemoval = useCallback((imageIds: string[]) => {
    const idSet = new Set(imageIds);

    setViewerState((current) => {
      if (!current.images.length) {
        return current;
      }

      const currentImageId = current.images[current.currentIndex]?.id;
      const nextImages = current.images.filter((image) => !idSet.has(image.id));

      if (nextImages.length === 0) {
        setIsFullscreenOpen(false);
        return {
          isOpen: false,
          currentIndex: 0,
          images: [],
        };
      }

      const nextIndex =
        currentImageId && !idSet.has(currentImageId)
          ? nextImages.findIndex((image) => image.id === currentImageId)
          : Math.min(current.currentIndex, nextImages.length - 1);

      return {
        isOpen: current.isOpen,
        currentIndex: nextIndex >= 0 ? nextIndex : 0,
        images: nextImages,
      };
    });
  }, []);

  const runMutation = useCallback(async (options: {
    action: PendingAction;
    successMessage: string;
    errorMessage: string;
    task: () => Promise<void>;
  }) => {
    if (mutationLockRef.current || uploadLockRef.current) {
      return false;
    }

    try {
      mutationLockRef.current = true;
      setPendingAction(options.action);

      try {
        await options.task();
        pushToast("success", options.successMessage);
        refresh();
        return true;
      } catch (error) {
        pushToast("error", resolveErrorMessage(error, options.errorMessage));
        return false;
      } finally {
        setPendingAction(null);
      }
    } finally {
      mutationLockRef.current = false;
    }
  }, [pushToast, refresh]);

  async function handleCreateFolder(name: string) {
    const success = await runMutation({
      action: "create-folder",
      successMessage: "フォルダーを作成しました。",
      errorMessage: "フォルダーを作成できませんでした。",
      task: async () => {
        await createFolder(supabase, name);
      },
    });

    if (success) {
      setCreateModalOpen(false);
    }
  }

  async function handleRenameFolder(name: string) {
    if (!editingFolder) {
      return;
    }

    const success = await runMutation({
      action: "rename-folder",
      successMessage: "フォルダー名を変更しました。",
      errorMessage: "フォルダー名を変更できませんでした。",
      task: async () => {
        await renameFolder(supabase, editingFolder.id, name);
      },
    });

    if (success) {
      setEditingFolder(null);
    }
  }

  async function handleDeleteFolder() {
    if (!folderToDelete) {
      return;
    }

    const deletingCurrentFolder =
      activeFilters.scope.type === "folder" && activeFilters.scope.folderId === folderToDelete.id;

    const success = await runMutation({
      action: "delete-folder",
      successMessage: "フォルダーを削除しました。中の画像は未分類へ移動されます。",
      errorMessage: "フォルダーを削除できませんでした。",
      task: async () => {
        await deleteFolder(supabase, folderToDelete.id);

        if (deletingCurrentFolder) {
          router.push("/gallery");
        }
      },
    });

    if (success) {
      setFolderToDelete(null);
    }
  }

  const handleToggleFavorite = useCallback(async (imageId: string, nextValue: boolean) => {
    await runMutation({
      action: "favorite-image",
      successMessage: nextValue ? "お気に入りに追加しました。" : "お気に入りを解除しました。",
      errorMessage: "お気に入り状態を更新できませんでした。",
      task: async () => {
        await toggleFavorite(supabase, imageId, nextValue);
        patchGalleryImages([imageId], (image) => ({ ...image, is_favorite: nextValue }));
        patchViewerImages([imageId], (image) => ({ ...image, is_favorite: nextValue }));
      },
    });
  }, [patchGalleryImages, patchViewerImages, runMutation, supabase]);

  async function handleUploadFiles(files: File[]) {
    if (uploadLockRef.current || mutationLockRef.current) {
      return;
    }

    try {
      uploadLockRef.current = true;
      setIsUploading(true);

      try {
        const results = await uploadImages(supabase, {
          userId,
          scope: activeFilters.scope,
          files,
        });

        const successCount = results.filter((item) => item.status === "success").length;
        const errors = results.filter((item) => item.status === "error");

        if (successCount > 0) {
          pushToast(
            "success",
            successCount === 1
              ? "画像をアップロードしました。"
              : `${successCount} 件の画像をアップロードしました。`,
          );
          refresh();
        }

        if (errors.length > 0) {
          const firstError = errors[0]?.error ?? "アップロードに失敗しました。";
          pushToast(
            "error",
            errors.length === 1
              ? firstError
              : `${errors.length} 件のアップロードに失敗しました。最初のエラー: ${firstError}`,
          );
        }
      } catch (error) {
        pushToast("error", resolveErrorMessage(error, "アップロードに失敗しました。"));
      }
    } finally {
      uploadLockRef.current = false;
      setIsUploading(false);
    }
  }

  async function handleLogout() {
    if (pending) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      pushToast("error", resolveErrorMessage(error, "ログアウトに失敗しました。"));
      return;
    }

    clearGalleryPageCacheForUser(userId);
    router.push("/login");
    router.refresh();
  }

  const openViewer = useCallback((index: number) => {
    if (pending) {
      return;
    }

    setViewerState({
      isOpen: true,
      currentIndex: index,
      images: galleryImagesRef.current,
    });
    setIsFullscreenOpen(false);
  }, [pending]);

  const closeViewer = useCallback(() => {
    setViewerState((current) => ({
      ...current,
      isOpen: false,
    }));
    setIsFullscreenOpen(false);
  }, []);

  function moveViewer(direction: -1 | 1) {
    setViewerState((current) => {
      if (!current.isOpen) {
        return current;
      }

      const nextIndex = current.currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= current.images.length) {
        return current;
      }

      return {
        ...current,
        currentIndex: nextIndex,
      };
    });
  }

  function enterSelectionMode() {
    if (pending) {
      return;
    }

    resetSelectionState(true);
  }

  function exitSelectionMode() {
    resetSelectionState(false);
  }

  function toggleSelectionMode() {
    if (isSelectionMode) {
      exitSelectionMode();
      return;
    }

    enterSelectionMode();
  }

  const toggleSelectImage = useCallback((imageId: string) => {
    if (pending) {
      return;
    }

    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
  }, [pending]);

  const selectAllImages = useCallback(() => {
    if (pending) {
      return;
    }

    setSelectedImageIds(galleryImagesRef.current.map((image) => image.id));
  }, [pending]);

  const clearSelection = useCallback(() => {
    setSelectedImageIds([]);
  }, []);

  async function handleViewerRename(fileName: string) {
    const currentImage = viewerState.images[viewerState.currentIndex];

    if (!currentImage) {
      return;
    }

    await runMutation({
      action: "rename-image",
      successMessage: "画像名を変更しました。",
      errorMessage: "画像名を変更できませんでした。",
      task: async () => {
        const nextFileName = await renameImage(supabase, currentImage.id, fileName);

        patchGalleryImages([currentImage.id], (image) => ({ ...image, file_name: nextFileName }));
        patchViewerImages([currentImage.id], (image) => ({ ...image, file_name: nextFileName }));
      },
    });
  }

  async function handleViewerMoveFolder(folderId: string | null) {
    const currentImage = viewerState.images[viewerState.currentIndex];

    if (!currentImage) {
      return;
    }

    await runMutation({
      action: "move-image",
      successMessage: "フォルダー移動を保存しました。",
      errorMessage: "フォルダー移動に失敗しました。",
      task: async () => {
        await moveImageToFolder(supabase, currentImage.id, folderId);

        if (folderId) {
          await touchFolder(supabase, folderId);
        }

        const folderName = getFolderName(folderId);

        patchGalleryImages([currentImage.id], (image) => ({
          ...image,
          folder_id: folderId,
          folder_name: folderName,
        }));
        patchViewerImages([currentImage.id], (image) => ({
          ...image,
          folder_id: folderId,
          folder_name: folderName,
        }));
      },
    });
  }

  async function handleViewerToggleFavorite(nextValue: boolean) {
    const currentImage = viewerState.images[viewerState.currentIndex];

    if (!currentImage) {
      return;
    }

    await runMutation({
      action: "favorite-image",
      successMessage: nextValue ? "お気に入りに追加しました。" : "お気に入りを解除しました。",
      errorMessage: "お気に入り状態を更新できませんでした。",
      task: async () => {
        await toggleFavorite(supabase, currentImage.id, nextValue);
        patchGalleryImages([currentImage.id], (image) => ({ ...image, is_favorite: nextValue }));
        patchViewerImages([currentImage.id], (image) => ({ ...image, is_favorite: nextValue }));
      },
    });
  }

  async function handleViewerDelete() {
    const currentImage = viewerState.images[viewerState.currentIndex];

    if (!currentImage) {
      return;
    }

    await runMutation({
      action: "delete-image",
      successMessage: "画像を削除しました。",
      errorMessage: "画像を削除できませんでした。",
      task: async () => {
        const result = await deleteImagesWithStorage(supabase, [currentImage]);
        removeGalleryImages([currentImage.id]);
        reconcileViewerAfterRemoval([currentImage.id]);
        setSelectedImageIds((current) => current.filter((id) => id !== currentImage.id));

        if (result.storageErrorMessage) {
          pushToast(
            "error",
            `データベースからは削除されましたが、Storage の削除に失敗しました。${result.storageErrorMessage}`,
          );
        }
      },
    });
  }

  async function handleBulkDelete() {
    if (selectedImageIds.length === 0) {
      return;
    }

    const targetImages = galleryImages.filter((image) => selectedImageIdSet.has(image.id));
    const targetIds = targetImages.map((image) => image.id);

    if (targetIds.length === 0) {
      return;
    }

    await runMutation({
      action: "bulk-delete",
      successMessage: "選択した画像を削除しました。",
      errorMessage: "一括削除に失敗しました。",
      task: async () => {
        const result = await deleteImagesWithStorage(supabase, targetImages);
        removeGalleryImages(targetIds);
        reconcileViewerAfterRemoval(targetIds);
        clearSelection();
        setIsBulkDeleteConfirmOpen(false);

        if (galleryImages.length - targetIds.length <= 0) {
          setIsSelectionMode(false);
        }

        if (result.storageErrorMessage) {
          pushToast(
            "error",
            `データベースからは削除されましたが、Storage の削除に失敗しました。${result.storageErrorMessage}`,
          );
        }
      },
    });
  }

  async function handleBulkMove() {
    if (selectedImageIds.length === 0) {
      return;
    }

    const nextFolderId = selectionMoveTargetFolderId || null;

    await runMutation({
      action: "bulk-move",
      successMessage: "選択した画像を移動しました。",
      errorMessage: "一括フォルダー移動に失敗しました。",
      task: async () => {
        await moveImagesToFolder(supabase, selectedImageIds, nextFolderId);

        if (nextFolderId) {
          await touchFolder(supabase, nextFolderId);
        }

        const folderName = getFolderName(nextFolderId);

        patchGalleryImages(selectedImageIds, (image) => ({
          ...image,
          folder_id: nextFolderId,
          folder_name: folderName,
        }));
        patchViewerImages(selectedImageIds, (image) => ({
          ...image,
          folder_id: nextFolderId,
          folder_name: folderName,
        }));
        clearSelection();
      },
    });
  }

  async function handleBulkFavorite(nextValue: boolean) {
    if (selectedImageIds.length === 0) {
      return;
    }

    await runMutation({
      action: "bulk-favorite",
      successMessage: nextValue
        ? "選択した画像をお気に入りに追加しました。"
        : "選択した画像のお気に入りを解除しました。",
      errorMessage: "一括お気に入り更新に失敗しました。",
      task: async () => {
        await setImagesFavorite(supabase, selectedImageIds, nextValue);

        patchGalleryImages(selectedImageIds, (image) => ({
          ...image,
          is_favorite: nextValue,
        }));
        patchViewerImages(selectedImageIds, (image) => ({
          ...image,
          is_favorite: nextValue,
        }));
        clearSelection();
      },
    });
  }

  return (
    <>
      <ToastStack items={toasts} />

      <ImageDetailModal
        open={viewerState.isOpen && !isFullscreenOpen}
        pending={pending}
        folders={folders}
        viewerState={viewerState}
        onClose={closeViewer}
        onPrevious={() => moveViewer(-1)}
        onNext={() => moveViewer(1)}
        onOpenFullscreen={() => {
          fullscreenReturnFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setIsFullscreenOpen(true);
        }}
        onRename={handleViewerRename}
        onMoveFolder={handleViewerMoveFolder}
        onDelete={handleViewerDelete}
        onToggleFavorite={handleViewerToggleFavorite}
      />

      <FullscreenViewer
        open={viewerState.isOpen && isFullscreenOpen}
        viewerState={viewerState}
        returnFocusRef={fullscreenReturnFocusRef}
        onClose={() => setIsFullscreenOpen(false)}
        onPrevious={() => moveViewer(-1)}
        onNext={() => moveViewer(1)}
      />

      <CreateFolderModal
        open={createModalOpen}
        pending={pending}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateFolder}
      />

      <EditFolderModal
        folder={editingFolder}
        pending={pending}
        onClose={() => setEditingFolder(null)}
        onSubmit={handleRenameFolder}
      />

      <ConfirmDialog
        open={folderToDelete !== null}
        title="フォルダーを削除しますか？"
        description="フォルダー自体は削除されますが、中の画像は削除されず未分類へ移動されます。"
        confirmLabel="削除する"
        intent="danger"
        pending={pending}
        onConfirm={handleDeleteFolder}
        onClose={() => setFolderToDelete(null)}
      />

      <ConfirmDialog
        open={isBulkDeleteConfirmOpen}
        title="選択した画像を削除しますか？"
        description="元に戻せません。Storage とデータベースの両方からまとめて削除します。"
        confirmLabel="一括削除する"
        intent="danger"
        pending={pending}
        onConfirm={handleBulkDelete}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
      />

      <main className="min-h-screen bg-[#f6f6f7] px-3 py-3 sm:px-4">
        <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1560px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[248px_minmax(0,1fr)]">
          <Sidebar
            userEmail={userEmail}
            currentScope={activeFilters.scope}
            folders={folders}
            pending={pending}
            onSelectAll={() => navigateWith({ scope: { type: "all" } })}
            onSelectUncategorized={() => navigateWith({ scope: { type: "uncategorized" } })}
            onSelectFavorites={() => navigateWith({ scope: { type: "favorites" } })}
            onSelectFolder={(folderId) => navigateWith({ scope: { type: "folder", folderId } })}
            onCreateFolder={() => setCreateModalOpen(true)}
            onEditFolder={(folder) => setEditingFolder(folder)}
            onDeleteFolder={(folder) => setFolderToDelete(folder)}
            onLogout={handleLogout}
          />

          <section className="min-w-0 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col px-4 py-4 sm:px-5">
              <GalleryHeader
                title={currentTitle}
                imageCount={activePagination.totalCount}
                sort={activeFilters.sort}
                view={activeFilters.view}
                isSelectionMode={isSelectionMode}
                pending={pending}
                onChangeSort={(sort) => navigateWith({ sort })}
                onChangeView={(view) => navigateWith({ view })}
                onToggleSelectionMode={toggleSelectionMode}
              />

              <div className="mt-4">
                <UploadDropzone pending={pending} onFiles={handleUploadFiles} />
              </div>

              <div className="mt-2.5">
                <ClipboardPasteZone enabled={!pending} onFiles={handleUploadFiles} />
              </div>

              {isSelectionMode ? (
                <div className="mt-3">
                  <SelectionToolbar
                    selectedCount={selectedImageIds.length}
                    totalCount={galleryImages.length}
                    folders={folders}
                    moveTargetFolderId={selectionMoveTargetFolderId}
                    pending={pending}
                    pendingLabel={pendingMessage}
                    onChangeMoveTargetFolderId={setSelectionMoveTargetFolderId}
                    onSelectAll={selectAllImages}
                    onClearSelection={clearSelection}
                    onDeleteSelected={() => setIsBulkDeleteConfirmOpen(true)}
                    onMoveSelected={handleBulkMove}
                    onFavoriteSelected={handleBulkFavorite}
                    onExit={exitSelectionMode}
                  />
                </div>
              ) : null}

              <div className="mt-4 flex-1">
                {pending ? <LoadingState message={pendingMessage ?? "処理中です..."} compact /> : null}

                {!pending && galleryImages.length === 0 ? (
                  <EmptyState
                    title={emptyStateCopy.title}
                    description={emptyStateCopy.description}
                    hint={emptyStateCopy.hint}
                  />
                ) : null}

                {galleryImages.length > 0 && activeFilters.view === "grid" ? (
                  <ImageGrid
                    images={galleryImages}
                    isSelectionMode={isSelectionMode}
                    selectedImageIds={selectedImageIdSet}
                    pending={pending}
                    onOpen={openViewer}
                    onToggleSelect={toggleSelectImage}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ) : null}

                {galleryImages.length > 0 && activeFilters.view === "list" ? (
                  <ImageList
                    images={galleryImages}
                    isSelectionMode={isSelectionMode}
                    selectedImageIds={selectedImageIdSet}
                    pending={pending}
                    onOpen={openViewer}
                    onToggleSelect={toggleSelectImage}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ) : null}

                {activePagination.totalCount > 0 ? (
                  <div className="mt-4">
                    <GalleryPaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={activePagination.pageSize}
                      totalCount={activePagination.totalCount}
                      pending={pending}
                      hasPreviousPage={activePagination.hasPreviousPage}
                      hasNextPage={activePagination.hasNextPage}
                      onPrevious={() => navigateWith({ page: currentPage - 1 })}
                      onNext={() => navigateWith({ page: currentPage + 1 })}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
