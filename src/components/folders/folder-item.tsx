"use client";

import { cn } from "@/lib/utils/format";
import type { FolderRow } from "@/types/folder";

type FolderItemProps = {
  folder: FolderRow;
  selected: boolean;
  disabled?: boolean;
  onPreload: (folderId: string) => void;
  onOpen: (folderId: string) => void;
  onEdit: (folder: FolderRow) => void;
  onDelete: (folder: FolderRow) => void;
};

export function FolderItem({
  folder,
  selected,
  disabled = false,
  onPreload,
  onOpen,
  onEdit,
  onDelete,
}: FolderItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition",
        selected ? "bg-slate-200 text-slate-900" : "text-slate-700 hover:bg-slate-100",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onOpen(folder.id)}
        onPointerEnter={() => onPreload(folder.id)}
        onFocus={() => onPreload(folder.id)}
        aria-label={`${folder.name} を開く`}
        disabled={disabled}
      >
        {folder.name}
      </button>
      <button
        type="button"
        className="rounded px-1.5 py-1 text-[11px] text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onEdit(folder)}
        aria-label={`${folder.name} の名前を変更`}
        disabled={disabled}
      >
        編集
      </button>
      <button
        type="button"
        className="rounded px-1.5 py-1 text-[11px] text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onDelete(folder)}
        aria-label={`${folder.name} を削除`}
        disabled={disabled}
      >
        削除
      </button>
    </div>
  );
}
