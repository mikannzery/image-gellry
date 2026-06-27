"use client";

import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deleteImagesWithStorage,
  moveImageToFolder,
  moveImagesToFolder,
  renameImage,
  setImagesFavorite,
  toggleFavorite,
  touchFolder,
} from "@/lib/gallery/mutations";
import type { GalleryImageItem } from "@/types/image";

type ImageMutationAction =
  | "rename-image"
  | "move-image"
  | "delete-image"
  | "favorite-image"
  | "bulk-delete"
  | "bulk-move"
  | "bulk-favorite";

export type ImageMutationRunnerOptions = {
  action: ImageMutationAction;
  successMessage: string;
  errorMessage: string;
  task: () => Promise<void>;
};

type UseGalleryImageMutationsOptions = {
  supabase: SupabaseClient;
  galleryImages: GalleryImageItem[];
  selectedImageIds: string[];
  selectedImageIdSet: Set<string>;
  selectionMoveTargetFolderId: string;
  currentViewerImage: GalleryImageItem | null;
  getFolderName: (folderId: string | null) => string | null;
  runMutation: (options: ImageMutationRunnerOptions) => Promise<boolean>;
  patchGalleryImages: (
    imageIds: string[],
    updater: (image: GalleryImageItem) => GalleryImageItem,
  ) => void;
  removeGalleryImages: (imageIds: string[]) => void;
  patchViewerImages: (
    imageIds: string[],
    updater: (image: GalleryImageItem) => GalleryImageItem,
  ) => void;
  reconcileViewerAfterRemoval: (imageIds: string[]) => void;
  removeSelectedImageIds: (imageIds: string[]) => void;
  clearSelection: () => void;
  exitSelectionMode: () => void;
  setIsBulkDeleteConfirmOpen: (open: boolean) => void;
  pushErrorToast: (message: string) => void;
};

export function useGalleryImageMutations({
  supabase,
  galleryImages,
  selectedImageIds,
  selectedImageIdSet,
  selectionMoveTargetFolderId,
  currentViewerImage,
  getFolderName,
  runMutation,
  patchGalleryImages,
  removeGalleryImages,
  patchViewerImages,
  reconcileViewerAfterRemoval,
  removeSelectedImageIds,
  clearSelection,
  exitSelectionMode,
  setIsBulkDeleteConfirmOpen,
  pushErrorToast,
}: UseGalleryImageMutationsOptions) {
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

  const handleViewerRename = useCallback(async (fileName: string) => {
    const currentImage = currentViewerImage;

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
  }, [currentViewerImage, patchGalleryImages, patchViewerImages, runMutation, supabase]);

  const handleViewerMoveFolder = useCallback(async (folderId: string | null) => {
    const currentImage = currentViewerImage;

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
  }, [currentViewerImage, getFolderName, patchGalleryImages, patchViewerImages, runMutation, supabase]);

  const handleViewerToggleFavorite = useCallback(async (nextValue: boolean) => {
    const currentImage = currentViewerImage;

    if (!currentImage) {
      return;
    }

    await handleToggleFavorite(currentImage.id, nextValue);
  }, [currentViewerImage, handleToggleFavorite]);

  const handleViewerDelete = useCallback(async () => {
    const currentImage = currentViewerImage;

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
        removeSelectedImageIds([currentImage.id]);

        if (result.storageErrorMessage) {
          pushErrorToast(
            `データベースからは削除されましたが、Storage の削除に失敗しました。${result.storageErrorMessage}`,
          );
        }
      },
    });
  }, [
    currentViewerImage,
    pushErrorToast,
    reconcileViewerAfterRemoval,
    removeGalleryImages,
    removeSelectedImageIds,
    runMutation,
    supabase,
  ]);

  const handleBulkDelete = useCallback(async () => {
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
          exitSelectionMode();
        }

        if (result.storageErrorMessage) {
          pushErrorToast(
            `データベースからは削除されましたが、Storage の削除に失敗しました。${result.storageErrorMessage}`,
          );
        }
      },
    });
  }, [
    clearSelection,
    exitSelectionMode,
    galleryImages,
    pushErrorToast,
    reconcileViewerAfterRemoval,
    removeGalleryImages,
    runMutation,
    selectedImageIdSet,
    selectedImageIds.length,
    setIsBulkDeleteConfirmOpen,
    supabase,
  ]);

  const handleBulkMove = useCallback(async () => {
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
  }, [
    clearSelection,
    getFolderName,
    patchGalleryImages,
    patchViewerImages,
    runMutation,
    selectedImageIds,
    selectionMoveTargetFolderId,
    supabase,
  ]);

  const handleBulkFavorite = useCallback(async (nextValue: boolean) => {
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
  }, [clearSelection, patchGalleryImages, patchViewerImages, runMutation, selectedImageIds, supabase]);

  return {
    handleToggleFavorite,
    handleViewerRename,
    handleViewerMoveFolder,
    handleViewerToggleFavorite,
    handleViewerDelete,
    handleBulkDelete,
    handleBulkMove,
    handleBulkFavorite,
  };
}
