"use client";

import { FolderItem } from "@/components/folders/folder-item";
import type { FolderRow } from "@/types/folder";

type FolderListProps = {
  folders: FolderRow[];
  currentFolderId?: string;
  disabled?: boolean;
  onOpen: (folderId: string) => void;
  onEdit: (folder: FolderRow) => void;
  onDelete: (folder: FolderRow) => void;
};

export function FolderList({
  folders,
  currentFolderId,
  disabled = false,
  onOpen,
  onEdit,
  onDelete,
}: FolderListProps) {
  return (
    <div className="space-y-1">
      {folders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          まだ通常フォルダーはありません。
        </div>
      ) : null}

      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          selected={currentFolderId === folder.id}
          disabled={disabled}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
