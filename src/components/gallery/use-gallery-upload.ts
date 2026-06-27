"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { uploadImages } from "@/lib/gallery/upload";
import type { GalleryScope } from "@/types/gallery";
import type { ToastItem } from "@/components/shared/toast";

type UseGalleryUploadOptions = {
  supabase: SupabaseClient;
  userId: string;
  scope: GalleryScope;
  uploadLockRef: MutableRefObject<boolean>;
  mutationLockRef: MutableRefObject<boolean>;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  refresh: () => void;
  pushToast: (variant: ToastItem["variant"], message: string) => void;
};

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function useGalleryUpload({
  supabase,
  userId,
  scope,
  uploadLockRef,
  mutationLockRef,
  setIsUploading,
  refresh,
  pushToast,
}: UseGalleryUploadOptions) {
  const handleUploadFiles = useCallback(async (files: File[]) => {
    if (uploadLockRef.current || mutationLockRef.current) {
      return;
    }

    try {
      uploadLockRef.current = true;
      setIsUploading(true);

      try {
        const results = await uploadImages(supabase, {
          userId,
          scope,
          files,
        });

        const successCount = results.filter((item) => item.status === "success").length;
        const errors = results.filter((item) => item.status === "error");

        if (successCount > 0) {
          pushToast(
            "success",
            successCount === 1
              ? "画像をアップロードしました。"
              : `${successCount} 件の画像をアップロードしました。`,
          );
          refresh();
        }

        if (errors.length > 0) {
          const firstError = errors[0]?.error ?? "アップロードに失敗しました。";
          pushToast(
            "error",
            errors.length === 1
              ? firstError
              : `${errors.length} 件のアップロードに失敗しました。最初のエラー: ${firstError}`,
          );
        }
      } catch (error) {
        pushToast("error", resolveErrorMessage(error, "アップロードに失敗しました。"));
      }
    } finally {
      uploadLockRef.current = false;
      setIsUploading(false);
    }
  }, [
    mutationLockRef,
    pushToast,
    refresh,
    scope,
    setIsUploading,
    supabase,
    uploadLockRef,
    userId,
  ]);

  return {
    handleUploadFiles,
  };
}
