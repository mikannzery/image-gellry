"use client";

import {
  isGallerySortOrder,
  type GallerySortOrder,
  type GalleryViewMode,
} from "@/types/gallery";

type GalleryHeaderProps = {
  title: string;
  imageCount: number;
  sort: GallerySortOrder;
  view: GalleryViewMode;
  isSelectionMode: boolean;
  pending?: boolean;
  onChangeSort: (sort: GallerySortOrder) => void;
  onChangeView: (view: GalleryViewMode) => void;
  onToggleSelectionMode: () => void;
};

export function GalleryHeader({
  title,
  imageCount,
  sort,
  view,
  isSelectionMode,
  pending = false,
  onChangeSort,
  onChangeView,
  onToggleSelectionMode,
}: GalleryHeaderProps) {
  return (
    <header className="border-b border-slate-200 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-[30px] font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{imageCount} 件の画像</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-600">
            <span>並び順</span>
            <select
              className="bg-transparent text-[13px] font-medium text-slate-900 outline-none"
              value={sort}
              onChange={(event) => {
                if (isGallerySortOrder(event.target.value)) {
                  onChangeSort(event.target.value);
                }
              }}
              disabled={pending}
              aria-label="画像の並び順"
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
            </select>
          </label>

          <button
            type="button"
            className={`rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelectionMode
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={onToggleSelectionMode}
            disabled={pending}
            aria-label={isSelectionMode ? "選択モードを終了" : "選択モードを開始"}
          >
            {isSelectionMode ? "選択終了" : "選択モード"}
          </button>

          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                view === "grid" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => onChangeView("grid")}
              disabled={pending}
              aria-label="グリッド表示に切り替える"
            >
              グリッド
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                view === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => onChangeView("list")}
              disabled={pending}
              aria-label="リスト表示に切り替える"
            >
              リスト
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
