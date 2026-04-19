"use client";

import { memo } from "react";
import Image from "next/image";

import { formatBytes, formatDimensions } from "@/lib/utils/format";
import type { GalleryImageItem } from "@/types/image";

type ImageGridCardProps = {
  image: GalleryImageItem;
  index: number;
  isSelectionMode: boolean;
  selected: boolean;
  pending?: boolean;
  onOpen: (index: number) => void;
  onToggleSelect: (imageId: string) => void;
  onToggleFavorite: (imageId: string, nextValue: boolean) => Promise<void>;
};

function ImageGridCardComponent({
  image,
  index,
  isSelectionMode,
  selected,
  pending = false,
  onOpen,
  onToggleSelect,
  onToggleFavorite,
}: ImageGridCardProps) {
  const imageUrl = image.thumbnail_url ?? image.signed_url;
  const handlePrimaryAction = () => {
    if (pending) {
      return;
    }

    if (isSelectionMode) {
      onToggleSelect(image.id);
      return;
    }

    onOpen(index);
  };

  return (
    <article
      role="button"
      tabIndex={pending ? -1 : 0}
      aria-label={
        isSelectionMode ? `${image.file_name} を選択` : `${image.file_name} の詳細を開く`
      }
      aria-pressed={isSelectionMode ? selected : undefined}
      className={`overflow-hidden rounded-lg border bg-white transition ${
        pending ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:border-slate-300"
      } ${selected ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"}`}
      onClick={handlePrimaryAction}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !pending) {
          event.preventDefault();
          handlePrimaryAction();
        }
      }}
    >
      <div className="relative aspect-[5/4] bg-slate-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={image.file_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            priority={index < 4}
            loading={index < 4 ? "eager" : "lazy"}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            プレビューなし
          </div>
        )}

        {isSelectionMode ? (
          <button
            type="button"
            aria-label={selected ? `${image.file_name} の選択を解除` : `${image.file_name} を選択`}
            className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold ${
              selected
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              if (!pending) {
                onToggleSelect(image.id);
              }
            }}
            disabled={pending}
          >
            {selected ? "✓" : ""}
          </button>
        ) : null}

        <button
          type="button"
          className={`absolute right-2 top-2 rounded border px-1.5 py-1 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
            image.is_favorite
              ? "border-amber-200 bg-amber-100 text-amber-900"
              : "border-slate-200 bg-white text-slate-600"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (!pending) {
              void onToggleFavorite(image.id, !image.is_favorite);
            }
          }}
          disabled={pending}
          aria-label={
            image.is_favorite
              ? `${image.file_name} をお気に入りから外す`
              : `${image.file_name} をお気に入りに追加`
          }
        >
          {image.is_favorite ? "お気に入り" : "追加"}
        </button>
      </div>

      <div className="space-y-0.5 px-2 py-1.5">
        <p className="truncate text-[12px] font-medium text-slate-900">{image.file_name}</p>
        <p className="text-[10px] text-slate-500">
          {formatDimensions(image.width, image.height)} ・ {formatBytes(image.size_bytes)}
        </p>
      </div>
    </article>
  );
}

export const ImageGridCard = memo(
  ImageGridCardComponent,
  (previousProps, nextProps) =>
    previousProps.image === nextProps.image &&
    previousProps.index === nextProps.index &&
    previousProps.isSelectionMode === nextProps.isSelectionMode &&
    previousProps.selected === nextProps.selected &&
    previousProps.pending === nextProps.pending,
);
