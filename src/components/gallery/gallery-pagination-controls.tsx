"use client";

type GalleryPaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  pending?: boolean;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function GalleryPaginationControls({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  pending = false,
  hasPreviousPage,
  hasNextPage,
  onPrevious,
  onNext,
}: GalleryPaginationControlsProps) {
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <nav
      aria-label="画像一覧のページ切り替え"
      className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-[12px] text-slate-500">
        {startIndex}-{endIndex} / {totalCount} 件
      </p>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <span className="text-[12px] text-slate-500">
          {currentPage} / {totalPages} ページ
        </span>

        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onPrevious}
          disabled={pending || !hasPreviousPage}
          aria-label="前のページへ移動"
        >
          前へ
        </button>

        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onNext}
          disabled={pending || !hasNextPage}
          aria-label="次のページへ移動"
        >
          次へ
        </button>
      </div>
    </nav>
  );
}
