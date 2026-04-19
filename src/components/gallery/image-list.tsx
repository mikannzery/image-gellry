"use client";

import { ImageListRow } from "@/components/gallery/image-list-row";
import type { GalleryImageItem } from "@/types/image";

type ImageListProps = {
  images: GalleryImageItem[];
  isSelectionMode: boolean;
  selectedImageIds: ReadonlySet<string>;
  pending?: boolean;
  onOpen: (index: number) => void;
  onToggleSelect: (imageId: string) => void;
  onToggleFavorite: (imageId: string, nextValue: boolean) => Promise<void>;
};

export function ImageList({
  images,
  isSelectionMode,
  selectedImageIds,
  pending = false,
  onOpen,
  onToggleSelect,
  onToggleFavorite,
}: ImageListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-slate-50 text-left text-[11px] font-medium uppercase tracking-[0.02em] text-slate-500">
            <tr>
              {isSelectionMode ? <th className="px-3 py-2.5">選択</th> : null}
              <th className="px-3 py-2.5">画像</th>
              <th className="px-3 py-2.5">ファイル名</th>
              <th className="px-3 py-2.5">解像度</th>
              <th className="px-3 py-2.5">サイズ</th>
              <th className="px-3 py-2.5">フォルダー</th>
              <th className="px-3 py-2.5">登録日</th>
              <th className="px-3 py-2.5">お気に入り</th>
            </tr>
          </thead>
          <tbody>
            {images.map((image, index) => (
              <ImageListRow
                key={image.id}
                image={image}
                index={index}
                isSelectionMode={isSelectionMode}
                selected={selectedImageIds.has(image.id)}
                pending={pending}
                onOpen={onOpen}
                onToggleSelect={onToggleSelect}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
