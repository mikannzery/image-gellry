"use client";

import { memo } from "react";
import Image from "next/image";

import { formatBytes, formatDateTime, formatDimensions } from "@/lib/utils/format";
import type { GalleryImageItem } from "@/types/image";

type ImageListRowProps = {
  image: GalleryImageItem;
  index: number;
  isSelectionMode: boolean;
  selected: boolean;
  pending?: boolean;
  onOpen: (index: number) => void;
  onToggleSelect: (imageId: string) => void;
  onToggleFavorite: (imageId: string, nextValue: boolean) => Promise<void>;
};

function ImageListRowComponent({
  image,
  index,
  isSelectionMode,
  selected,
  pending = false,
  onOpen,
  onToggleSelect,
  onToggleFavorite,
}: ImageListRowProps) {
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
    <tr
      tabIndex={pending ? -1 : 0}
      aria-selected={selected}
      className={`border-t border-slate-200 transition ${
        pending ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:bg-slate-50"
      } ${selected ? "bg-slate-100" : ""}`}
      onClick={handlePrimaryAction}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !pending) {
          event.preventDefault();
          handlePrimaryAction();
        }
      }}
    >
      {isSelectionMode ? (
        <td className="px-3 py-2.5">
          <button
            type="button"
            aria-label={selected ? `${image.file_name} の選択を解除` : `${image.file_name} を選択`}
            className={`flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold ${
              selected
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-500"
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
        </td>
      ) : null}

      <td className="px-3 py-2.5">
        <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={image.file_name}
              width={48}
              height={48}
              sizes="48px"
              className="h-full w-full object-cover"
              priority={index < 8}
              loading={index < 8 ? "eager" : "lazy"}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-slate-400">No image</div>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-[13px] font-medium text-slate-900">{image.file_name}</td>
      <td className="px-3 py-2.5 text-[13px] text-slate-600">{formatDimensions(image.width, image.height)}</td>
      <td className="px-3 py-2.5 text-[13px] text-slate-600">{formatBytes(image.size_bytes)}</td>
      <td className="px-3 py-2.5 text-[13px] text-slate-600">{image.folder_name ?? "未分類"}</td>
      <td className="px-3 py-2.5 text-[13px] text-slate-600">{formatDateTime(image.created_at)}</td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          className={`rounded border px-2 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
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
          {image.is_favorite ? "解除" : "追加"}
        </button>
      </td>
    </tr>
  );
}

export const ImageListRow = memo(
  ImageListRowComponent,
  (previousProps, nextProps) =>
    previousProps.image === nextProps.image &&
    previousProps.index === nextProps.index &&
    previousProps.isSelectionMode === nextProps.isSelectionMode &&
    previousProps.selected === nextProps.selected &&
    previousProps.pending === nextProps.pending,
);
