"use client";

import type { ReactNode } from "react";

import { FolderList } from "@/components/folders/folder-list";
import { cn } from "@/lib/utils/format";
import type { FolderRow } from "@/types/folder";
import type { GalleryScope } from "@/types/gallery";

type SidebarProps = {
  userEmail: string;
  currentScope: GalleryScope;
  folders: FolderRow[];
  pending?: boolean;
  onSelectAll: () => void;
  onSelectUncategorized: () => void;
  onSelectFavorites: () => void;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: FolderRow) => void;
  onDeleteFolder: (folder: FolderRow) => void;
  onLogout: () => Promise<void>;
};

export function Sidebar({
  userEmail,
  currentScope,
  folders,
  pending = false,
  onSelectAll,
  onSelectUncategorized,
  onSelectFavorites,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="flex h-full min-h-[calc(100vh-1.5rem)] flex-col bg-[#fcfcfc]">
      <div className="border-b border-slate-200 px-4 py-4">
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">フォルダー</h1>
        <button
          type="button"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCreateFolder}
          disabled={pending}
          aria-label="新規フォルダーを作成"
        >
          新規フォルダー
        </button>
      </div>

      <nav className="space-y-0.5 border-b border-slate-200 px-2.5 py-3" aria-label="ギャラリーカテゴリ">
        <SidebarButton selected={currentScope.type === "all"} disabled={pending} onClick={onSelectAll}>
          すべての画像
        </SidebarButton>
        <SidebarButton
          selected={currentScope.type === "uncategorized"}
          disabled={pending}
          onClick={onSelectUncategorized}
        >
          未分類
        </SidebarButton>
        <SidebarButton
          selected={currentScope.type === "favorites"}
          disabled={pending}
          onClick={onSelectFavorites}
        >
          お気に入り
        </SidebarButton>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <FolderList
          folders={folders}
          currentFolderId={currentScope.type === "folder" ? currentScope.folderId : undefined}
          disabled={pending}
          onOpen={onSelectFolder}
          onEdit={onEditFolder}
          onDelete={onDeleteFolder}
        />
      </div>

      <div className="mt-auto border-t border-slate-200 px-4 py-3">
        <p className="truncate text-xs text-slate-500">{userEmail || "Signed in"}</p>
        <button
          type="button"
          className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onLogout}
          disabled={pending}
          aria-label="ログアウト"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}

function SidebarButton({
  children,
  selected,
  disabled,
  onClick,
}: {
  children: ReactNode;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "bg-slate-200 text-slate-900" : "text-slate-700 hover:bg-slate-100",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
