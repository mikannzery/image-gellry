"use client";

import type { FolderRow } from "@/types/folder";

type SelectionToolbarProps = {
  selectedCount: number;
  totalCount: number;
  folders: FolderRow[];
  moveTargetFolderId: string;
  pending?: boolean;
  pendingLabel?: string | null;
  onChangeMoveTargetFolderId: (folderId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onMoveSelected: () => void;
  onFavoriteSelected: (nextValue: boolean) => void;
  onExit: () => void;
};

export function SelectionToolbar({
  selectedCount,
  totalCount,
  folders,
  moveTargetFolderId,
  pending = false,
  pendingLabel = null,
  onChangeMoveTargetFolderId,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onMoveSelected,
  onFavoriteSelected,
  onExit,
}: SelectionToolbarProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[13px] font-medium text-slate-900">
            {selectedCount} / {totalCount} 件を選択中
          </p>
          {pendingLabel ? (
            <p className="mt-1 text-[11px] text-slate-500" role="status" aria-live="polite">
              {pendingLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSelectAll}
            disabled={pending || totalCount === 0}
          >
            すべて選択
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClearSelection}
            disabled={pending || !hasSelection}
          >
            選択解除
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onFavoriteSelected(true)}
            disabled={pending || !hasSelection}
          >
            一括お気に入り追加
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onFavoriteSelected(false)}
            disabled={pending || !hasSelection}
          >
            一括お気に入り解除
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onExit}
            disabled={pending}
          >
            選択終了
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-col gap-2 lg:flex-row lg:items-center">
        <select
          className="min-w-[220px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          value={moveTargetFolderId}
          onChange={(event) => onChangeMoveTargetFolderId(event.target.value)}
          disabled={pending}
          aria-label="一括移動先フォルダー"
        >
          <option value="">未分類へ移動</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onMoveSelected}
          disabled={pending || !hasSelection}
        >
          一括フォルダー移動
        </button>
        <button
          type="button"
          className="rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onDeleteSelected}
          disabled={pending || !hasSelection}
        >
          一括削除
        </button>
      </div>
    </div>
  );
}
