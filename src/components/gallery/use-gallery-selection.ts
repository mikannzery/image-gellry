"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { GalleryImageItem } from "@/types/image";

type UseGallerySelectionOptions = {
  images: GalleryImageItem[];
  pending: boolean;
};

export function useGallerySelection({ images, pending }: UseGallerySelectionOptions) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState("");
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  const selectedImageIdSet = useMemo(() => new Set(selectedImageIds), [selectedImageIds]);

  useEffect(() => {
    const validIds = new Set(images.map((image) => image.id));
    setSelectedImageIds((current) => current.filter((id) => validIds.has(id)));
  }, [images]);

  useEffect(() => {
    if (!isSelectionMode && selectedImageIds.length > 0) {
      setSelectedImageIds([]);
    }
  }, [isSelectionMode, selectedImageIds.length]);

  useEffect(() => {
    if (selectedImageIds.length === 0) {
      setMoveTargetFolderId("");
      setIsBulkDeleteConfirmOpen(false);
    }
  }, [selectedImageIds.length]);

  useEffect(() => {
    if (isSelectionMode && images.length === 0) {
      setIsSelectionMode(false);
      setSelectedImageIds([]);
      setMoveTargetFolderId("");
      setIsBulkDeleteConfirmOpen(false);
    }
  }, [images.length, isSelectionMode]);

  const resetSelectionState = useCallback((nextMode = false) => {
    setIsSelectionMode(nextMode);
    setSelectedImageIds([]);
    setMoveTargetFolderId("");
    setIsBulkDeleteConfirmOpen(false);
  }, []);

  const enterSelectionMode = useCallback(() => {
    if (pending) {
      return;
    }

    resetSelectionState(true);
  }, [pending, resetSelectionState]);

  const exitSelectionMode = useCallback(() => {
    resetSelectionState(false);
  }, [resetSelectionState]);

  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      exitSelectionMode();
      return;
    }

    enterSelectionMode();
  }, [enterSelectionMode, exitSelectionMode, isSelectionMode]);

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

    setSelectedImageIds(images.map((image) => image.id));
  }, [images, pending]);

  const clearSelection = useCallback(() => {
    setSelectedImageIds([]);
  }, []);

  const removeSelectedImageIds = useCallback((imageIds: string[]) => {
    const removedIds = new Set(imageIds);
    setSelectedImageIds((current) => current.filter((id) => !removedIds.has(id)));
  }, []);

  return {
    isSelectionMode,
    selectedImageIds,
    selectedImageIdSet,
    moveTargetFolderId,
    isBulkDeleteConfirmOpen,
    setMoveTargetFolderId,
    setIsBulkDeleteConfirmOpen,
    resetSelectionState,
    exitSelectionMode,
    toggleSelectionMode,
    toggleSelectImage,
    selectAllImages,
    clearSelection,
    removeSelectedImageIds,
  };
}
