"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ImageGrid } from "@/components/gallery/image-grid";
import { ImageList } from "@/components/gallery/image-list";
import { GalleryPaginationControls } from "@/components/gallery/gallery-pagination-controls";
import { SelectionToolbar } from "@/components/gallery/selection-toolbar";
import {
  useGalleryFolderMutations,
  type FolderMutationRunnerOptions,
} from "@/components/gallery/use-gallery-folder-mutations";
import {
  useGalleryImageMutations,
  type ImageMutationRunnerOptions,
} from "@/components/gallery/use-gallery-image-mutations";
import { useGallerySelection } from "@/components/gallery/use-gallery-selection";
import { useGalleryUpload } from "@/components/gallery/use-gallery-upload";
import { useGalleryViewer } from "@/components/gallery/use-gallery-viewer";
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
  getCachedGalleryImagesById,
  getCachedGalleryPage,
  setCachedGalleryPage,
} from "@/lib/gallery/client-cache";
import { touchFolder } from "@/lib/gallery/mutations";
import { listImages } from "@/lib/gallery/queries";
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
import type { GalleryImageItem } from "@/types/image";

type GalleryShellProps = {
  userId: string;
  userEmail: string;
  folders: FolderRow[];
  images: GalleryImageItem[];
  pagination: GalleryPagination;
  initialFilters: GalleryFilters;
  signedUrlExpiresIn: number;
};

type GalleryPageLoadResult = {
  images: GalleryImageItem[];
  pagination: GalleryPagination;
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
  signedUrlExpiresIn,
}: GalleryShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const mutationLockRef = useRef(false);
  const uploadLockRef = useRef(false);
  const toastTimeoutIdsRef = useRef<number[]>([]);
  const lastTouchedFolderIdRef = useRef<string | null>(null);
  const galleryPageLoadsRef = useRef(new Map<string, Promise<GalleryPageLoadResult>>());
  const galleryPageCacheGenerationRef = useRef(0);
  const navigationRequestIdRef = useRef(0);

  const [galleryImages, setGalleryImages] = useState<GalleryImageItem[]>(images);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderRow | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeFilters, setActiveFilters] = useState<GalleryFilters>(initialFilters);
  const [activePagination, setActivePagination] = useState<GalleryPagination>(pagination);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const galleryImagesRef = useRef<GalleryImageItem[]>(images);

  const currentFolderId =
    activeFilters.scope.type === "folder" ? activeFilters.scope.folderId ?? null : null;
  const currentTitle = getGalleryTitle(activeFilters.scope, folders);
  const currentPage = activePagination.page;
  const totalPages = activePagination.totalPages;
  const pending = pendingAction !== null || isUploading || isGalleryLoading;
  const pendingMessage = isUploading
    ? "画像をアップロードしています..."
    : pendingAction
      ? pendingMessages[pendingAction]
      : isGalleryLoading
        ? "画像一覧を読み込んでいます..."
        : null;
  const folderNameMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const viewer = useGalleryViewer({ imagesRef: galleryImagesRef, pending });
  const {
    viewerState,
    currentViewerImage,
    isFullscreenOpen,
    fullscreenReturnFocusRef,
    openViewer,
    closeViewer,
    moveViewer,
    openFullscreen,
    closeFullscreen,
    patchViewerImages,
    reconcileViewerAfterRemoval,
  } = viewer;
  const selection = useGallerySelection({ images: galleryImages, pending });
  const {
    isSelectionMode,
    selectedImageIds,
    selectedImageIdSet,
    moveTargetFolderId: selectionMoveTargetFolderId,
    isBulkDeleteConfirmOpen,
    setMoveTargetFolderId: setSelectionMoveTargetFolderId,
    setIsBulkDeleteConfirmOpen,
    resetSelectionState,
    exitSelectionMode,
    toggleSelectionMode,
    toggleSelectImage,
    selectAllImages,
    clearSelection,
    removeSelectedImageIds,
  } = selection;
  const emptyStateCopy = useMemo(
    () => getEmptyStateCopy(activeFilters.scope, folders),
    [activeFilters.scope, folders],
  );

  useEffect(() => {
    navigationRequestIdRef.current += 1;
    setIsGalleryLoading(false);
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
    galleryPageCacheGenerationRef.current += 1;
    galleryPageLoadsRef.current.clear();
    clearGalleryPageCache();
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const loadGalleryPage = useCallback((
    scope: GalleryScope,
    sort: GallerySortOrder,
    page: number,
  ): Promise<GalleryPageLoadResult> => {
    const cacheKey = createGalleryDataKey(userId, scope, sort, page);
    const cachedPage = getCachedGalleryPage(cacheKey);

    if (cachedPage) {
      return Promise.resolve(cachedPage);
    }

    const existingLoad = galleryPageLoadsRef.current.get(cacheKey);

    if (existingLoad) {
      return existingLoad;
    }

    const cacheGeneration = galleryPageCacheGenerationRef.current;
    const knownImagesById = getCachedGalleryImagesById(userId);
    const loadStart = Date.now();
    const loadPromise = listImages(
      supabase,
      userId,
      scope,
      sort,
      folders,
      page,
      signedUrlExpiresIn,
      knownImagesById,
    )
      .then((result) => {
        if (galleryPageCacheGenerationRef.current === cacheGeneration) {
          setCachedGalleryPage(cacheKey, result.images, result.pagination);
        }

        debugGalleryPerformance("client page loaded", {
          key: cacheKey,
          count: result.images.length,
          elapsedMs: Date.now() - loadStart,
        });
        return result;
      })
      .finally(() => {
        if (galleryPageLoadsRef.current.get(cacheKey) === loadPromise) {
          galleryPageLoadsRef.current.delete(cacheKey);
        }
      });

    galleryPageLoadsRef.current.set(cacheKey, loadPromise);
    return loadPromise;
  }, [folders, signedUrlExpiresIn, supabase, userId]);

  const preloadGalleryScope = useCallback((scope: GalleryScope) => {
    if (pending) {
      return;
    }

    const isCurrentScope =
      scope.type === activeFilters.scope.type && scope.folderId === activeFilters.scope.folderId;

    if (isCurrentScope) {
      return;
    }

    void loadGalleryPage(scope, activeFilters.sort, 1).catch((error) => {
      debugGalleryPerformance("client page preload failed", {
        scope: scope.type,
        folderId: scope.folderId ?? null,
        message: resolveErrorMessage(error, "unknown error"),
      });
    });
  }, [activeFilters.scope, activeFilters.sort, loadGalleryPage, pending]);

  useEffect(() => {
    if (pending) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      folders.slice(0, 3).forEach((folder) => {
        preloadGalleryScope({ type: "folder", folderId: folder.id });
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [folders, pending, preloadGalleryScope]);

  async function navigateWith(
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
    const requestId = navigationRequestIdRef.current + 1;
    navigationRequestIdRef.current = requestId;
    setIsGalleryLoading(true);

    try {
      const loadedPage = await loadGalleryPage(scope, sort, page);

      if (navigationRequestIdRef.current !== requestId) {
        return;
      }

      setActiveFilters({ ...nextFilters, page: loadedPage.pagination.page });
      setActivePagination(loadedPage.pagination);
      setGalleryImages(loadedPage.images);
      galleryImagesRef.current = loadedPage.images;
      window.history.pushState(
        null,
        "",
        createGalleryUrl({ ...nextFilters, page: loadedPage.pagination.page }),
      );
    } catch (error) {
      if (navigationRequestIdRef.current !== requestId) {
        return;
      }

      debugGalleryPerformance("client page load failed, using server navigation", {
        key: cacheKey,
        message: resolveErrorMessage(error, "unknown error"),
      });
      router.push(nextUrl);
    } finally {
      if (navigationRequestIdRef.current === requestId) {
        setIsGalleryLoading(false);
      }
    }
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

  const runImageMutation = useCallback(
    (options: ImageMutationRunnerOptions) => runMutation(options),
    [runMutation],
  );
  const runFolderMutation = useCallback(
    (options: FolderMutationRunnerOptions) => runMutation(options),
    [runMutation],
  );

  const navigateToGalleryRoot = useCallback(() => {
    router.push("/gallery");
  }, [router]);

  const pushErrorToast = useCallback((message: string) => {
    pushToast("error", message);
  }, [pushToast]);

  const {
    handleToggleFavorite,
    handleViewerRename,
    handleViewerMoveFolder,
    handleViewerToggleFavorite,
    handleViewerDelete,
    handleBulkDelete,
    handleBulkMove,
    handleBulkFavorite,
  } = useGalleryImageMutations({
    supabase,
    galleryImages,
    selectedImageIds,
    selectedImageIdSet,
    selectionMoveTargetFolderId,
    currentViewerImage,
    getFolderName,
    runMutation: runImageMutation,
    patchGalleryImages,
    removeGalleryImages,
    patchViewerImages,
    reconcileViewerAfterRemoval,
    removeSelectedImageIds,
    clearSelection,
    exitSelectionMode,
    setIsBulkDeleteConfirmOpen,
    pushErrorToast,
  });

  const {
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
  } = useGalleryFolderMutations({
    supabase,
    editingFolder,
    folderToDelete,
    activeScope: activeFilters.scope,
    runMutation: runFolderMutation,
    onDeletedCurrentFolder: navigateToGalleryRoot,
    setCreateModalOpen,
    setEditingFolder,
    setFolderToDelete,
  });

  const { handleUploadFiles } = useGalleryUpload({
    supabase,
    userId,
    scope: activeFilters.scope,
    uploadLockRef,
    mutationLockRef,
    setIsUploading,
    refresh,
    pushToast,
  });

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
        onOpenFullscreen={openFullscreen}
        onRename={handleViewerRename}
        onMoveFolder={handleViewerMoveFolder}
        onDelete={handleViewerDelete}
        onToggleFavorite={handleViewerToggleFavorite}
      />

      <FullscreenViewer
        open={viewerState.isOpen && isFullscreenOpen}
        viewerState={viewerState}
        returnFocusRef={fullscreenReturnFocusRef}
        onClose={closeFullscreen}
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
        confirmLabel="削除する"
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
            onPreloadScope={preloadGalleryScope}
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
