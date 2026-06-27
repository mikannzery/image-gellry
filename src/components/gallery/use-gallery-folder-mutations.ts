"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createFolder, deleteFolder, renameFolder } from "@/lib/gallery/mutations";
import type { GalleryScope } from "@/types/gallery";
import type { FolderRow } from "@/types/folder";

type FolderMutationAction = "create-folder" | "rename-folder" | "delete-folder";

export type FolderMutationRunnerOptions = {
  action: FolderMutationAction;
  successMessage: string;
  errorMessage: string;
  task: () => Promise<void>;
};

type UseGalleryFolderMutationsOptions = {
  supabase: SupabaseClient;
  editingFolder: FolderRow | null;
  folderToDelete: FolderRow | null;
  activeScope: GalleryScope;
  runMutation: (options: FolderMutationRunnerOptions) => Promise<boolean>;
  onDeletedCurrentFolder: () => void;
  setCreateModalOpen: Dispatch<SetStateAction<boolean>>;
  setEditingFolder: Dispatch<SetStateAction<FolderRow | null>>;
  setFolderToDelete: Dispatch<SetStateAction<FolderRow | null>>;
};

export function useGalleryFolderMutations({
  supabase,
  editingFolder,
  folderToDelete,
  activeScope,
  runMutation,
  onDeletedCurrentFolder,
  setCreateModalOpen,
  setEditingFolder,
  setFolderToDelete,
}: UseGalleryFolderMutationsOptions) {
  const handleCreateFolder = useCallback(async (name: string) => {
    const success = await runMutation({
      action: "create-folder",
      successMessage: "フォルダーを作成しました。",
      errorMessage: "フォルダーを作成できませんでした。",
      task: async () => {
        await createFolder(supabase, name);
      },
    });

    if (success) {
      setCreateModalOpen(false);
    }
  }, [runMutation, setCreateModalOpen, supabase]);

  const handleRenameFolder = useCallback(async (name: string) => {
    if (!editingFolder) {
      return;
    }

    const success = await runMutation({
      action: "rename-folder",
      successMessage: "フォルダー名を変更しました。",
      errorMessage: "フォルダー名を変更できませんでした。",
      task: async () => {
        await renameFolder(supabase, editingFolder.id, name);
      },
    });

    if (success) {
      setEditingFolder(null);
    }
  }, [editingFolder, runMutation, setEditingFolder, supabase]);

  const handleDeleteFolder = useCallback(async () => {
    if (!folderToDelete) {
      return;
    }

    const deletingCurrentFolder =
      activeScope.type === "folder" && activeScope.folderId === folderToDelete.id;

    const success = await runMutation({
      action: "delete-folder",
      successMessage: "フォルダーを削除しました。中の画像は未分類へ移動されます。",
      errorMessage: "フォルダーを削除できませんでした。",
      task: async () => {
        await deleteFolder(supabase, folderToDelete.id);

        if (deletingCurrentFolder) {
          onDeletedCurrentFolder();
        }
      },
    });

    if (success) {
      setFolderToDelete(null);
    }
  }, [
    activeScope.folderId,
    activeScope.type,
    folderToDelete,
    onDeletedCurrentFolder,
    runMutation,
    setFolderToDelete,
    supabase,
  ]);

  return {
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
  };
}
