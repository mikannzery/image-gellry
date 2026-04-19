"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import Image from "next/image";

import type { ViewerState } from "@/types/image";

type FullscreenViewerProps = {
  open: boolean;
  viewerState: ViewerState;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function FullscreenViewer({
  open,
  viewerState,
  returnFocusRef,
  onClose,
  onPrevious,
  onNext,
}: FullscreenViewerProps) {
  const titleId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const returnFocusElement = returnFocusRef?.current ?? null;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && viewerState.currentIndex > 0) {
        event.preventDefault();
        event.stopPropagation();
        onPrevious();
      }

      if (event.key === "ArrowRight" && viewerState.currentIndex < viewerState.images.length - 1) {
        event.preventDefault();
        event.stopPropagation();
        onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusElement?.focus() ?? previousFocusRef.current?.focus();
    };
  }, [
    open,
    onClose,
    onNext,
    onPrevious,
    returnFocusRef,
    viewerState.currentIndex,
    viewerState.images.length,
  ]);

  if (!open || !viewerState.isOpen) {
    return null;
  }

  const currentImage = viewerState.images[viewerState.currentIndex];

  if (!currentImage) {
    return null;
  }

  const isFirst = viewerState.currentIndex <= 0;
  const isLast = viewerState.currentIndex >= viewerState.images.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] bg-black"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <h2 id={titleId} className="sr-only">
        全画面ビューア
      </h2>

      <button
        ref={closeButtonRef}
        type="button"
        className="absolute right-5 top-5 z-20 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
        onClick={onClose}
        aria-label="全画面ビューアを閉じる"
      >
        閉じる
      </button>

      <button
        type="button"
        className="absolute left-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
        onClick={onPrevious}
        disabled={isFirst}
        aria-label="前の画像へ移動"
      >
        前へ
      </button>

      <button
        type="button"
        className="absolute right-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
        onClick={onNext}
        disabled={isLast}
        aria-label="次の画像へ移動"
      >
        次へ
      </button>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 py-20">
        {currentImage.signed_url ? (
          <div className="relative h-full w-full">
            <Image
              src={currentImage.signed_url}
              alt={currentImage.file_name}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized
            />
          </div>
        ) : (
          <div className="text-sm text-slate-300">プレビューを表示できません</div>
        )}
      </div>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-full bg-white/10 px-5 py-3 text-sm text-white backdrop-blur">
        <span className="max-w-[40vw] truncate font-medium">{currentImage.file_name}</span>
        <span className="text-slate-300">
          {viewerState.currentIndex + 1} / {viewerState.images.length}
        </span>
      </div>
    </div>
  );
}
