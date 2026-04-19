"use client";

import { ImageGridCard } from "@/components/gallery/image-grid-card";
import type { GalleryImageItem } from "@/types/image";

type ImageGridProps = {
  images: GalleryImageItem[];
  isSelectionMode: boolean;
  selectedImageIds: ReadonlySet<string>;
  pending?: boolean;
  onOpen: (index: number) => void;
  onToggleSelect: (imageId: string) => void;
  onToggleFavorite: (imageId: string, nextValue: boolean) => Promise<void>;
};

export function ImageGrid({
  images,
  isSelectionMode,
  selectedImageIds,
  pending = false,
  onOpen,
  onToggleSelect,
  onToggleFavorite,
}: ImageGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {images.map((image, index) => (
        <ImageGridCard
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
    </div>
  );
}
