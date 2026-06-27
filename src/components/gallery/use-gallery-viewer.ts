"use client";

import { useCallback, useMemo, useRef, useState, type RefObject } from "react";

import type { GalleryImageItem, ViewerState } from "@/types/image";

type UseGalleryViewerOptions = {
  imagesRef: RefObject<GalleryImageItem[]>;
  pending: boolean;
};

export function useGalleryViewer({ imagesRef, pending }: UseGalleryViewerOptions) {
  const fullscreenReturnFocusRef = useRef<HTMLElement | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>({
    isOpen: false,
    currentIndex: 0,
    images: [],
  });
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const currentViewerImage = useMemo(
    () => viewerState.images[viewerState.currentIndex] ?? null,
    [viewerState],
  );

  const openViewer = useCallback((index: number) => {
    if (pending) {
      return;
    }

    setViewerState({
      isOpen: true,
      currentIndex: index,
      images: imagesRef.current,
    });
    setIsFullscreenOpen(false);
  }, [imagesRef, pending]);

  const closeViewer = useCallback(() => {
    setViewerState((current) => ({
      ...current,
      isOpen: false,
    }));
    setIsFullscreenOpen(false);
  }, []);

  const moveViewer = useCallback((direction: -1 | 1) => {
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
  }, []);

  const openFullscreen = useCallback(() => {
    fullscreenReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsFullscreenOpen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreenOpen(false);
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

  return {
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
  };
}
