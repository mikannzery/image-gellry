"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";

import { formatBytes, formatDateTime, formatDimensions } from "@/lib/utils/format";
import type { FolderRow } from "@/types/folder";
import type { ViewerState } from "@/types/image";

type ImageDetailModalProps = {
  open: boolean;
  pending?: boolean;
  folders: FolderRow[];
  viewerState: ViewerState;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenFullscreen: () => void;
  onRename: (fileName: string) => Promise<void>;
  onMoveFolder: (folderId: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleFavorite: (nextValue: boolean) => Promise<void>;
};

export function ImageDetailModal({
  open,
  pending = false,
  folders,
  viewerState,
  onClose,
  onPrevious,
  onNext,
  onOpenFullscreen,
  onRename,
  onMoveFolder,
  onDelete,
  onToggleFavorite,
}: ImageDetailModalProps) {
  const [fileName, setFileName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const currentImage = viewerState.images[viewerState.currentIndex];

  useEffect(() => {
    if (!currentImage) {
      return;
    }

    setFileName(currentImage.file_name);
    setSelectedFolderId(currentImage.folder_id ?? "");
    setIsDeleteConfirming(false);
  }, [currentImage]);

  useEffect(() => {
    if (!open || !currentImage) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, currentImage, onClose]);

  if (!open || !viewerState.isOpen || !currentImage) {
    return null;
  }

  const isFirst = viewerState.currentIndex <= 0;
  const isLast = viewerState.currentIndex >= viewerState.images.length - 1;
  const hasFileNameChanged = fileName.trim() !== currentImage.file_name;
  const hasFolderChanged = selectedFolderId !== (currentImage.folder_id ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="grid h-[min(88vh,920px)] w-full max-w-6xl gap-0 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-soft lg:grid-cols-[minmax(0,1.15fr)_420px]"
      >
        <div className="relative flex min-h-[360px] items-center justify-center bg-slate-950 px-6 py-6">
          {currentImage.display_url ? (
            <Image
              src={currentImage.display_url}
              alt={currentImage.file_name}
              fill
              sizes="(max-width: 1024px) 100vw, 70vw"
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="text-sm text-slate-300">プレビューを表示できません</div>
          )}

          <button
            ref={closeButtonRef}
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/18"
            onClick={onClose}
            aria-label="詳細モーダルを閉じる"
          >
            閉じる
          </button>

          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/12 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={onPrevious}
            disabled={isFirst || pending}
            aria-label="前の画像へ移動"
          >
            前へ
          </button>

          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/12 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={onNext}
            disabled={isLast || pending}
            aria-label="次の画像へ移動"
          >
            次へ
          </button>
        </div>

        <aside className="flex h-full flex-col overflow-y-auto bg-white p-6">
          <div className="space-y-3 border-b border-slate-200 pb-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Detail</p>
            <div>
              <h3 id={titleId} className="break-all text-2xl font-semibold text-ink">
                {currentImage.file_name}
              </h3>
              <p id={descriptionId} className="mt-2 text-sm text-slate-500">
                {viewerState.currentIndex + 1} / {viewerState.images.length}
              </p>
              {pending ? (
                <p className="mt-2 text-xs text-slate-500" role="status" aria-live="polite">
                  保存中のため、完了まで操作を制限しています。
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink">画像名</h4>
                <button
                  type="button"
                  className="text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void onRename(fileName)}
                  disabled={!hasFileNameChanged || pending || fileName.trim().length === 0}
                  aria-label="画像名を保存"
                >
                  保存
                </button>
              </div>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                maxLength={255}
                disabled={pending}
                aria-label="画像名"
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink">フォルダー移動</h4>
                <button
                  type="button"
                  className="text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void onMoveFolder(selectedFolderId || null)}
                  disabled={!hasFolderChanged || pending}
                  aria-label="フォルダー移動を保存"
                >
                  保存
                </button>
              </div>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
                disabled={pending}
                aria-label="移動先フォルダー"
              >
                <option value="">未分類</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink">お気に入り</h4>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                    currentImage.is_favorite
                      ? "bg-amber-400 text-slate-950"
                      : "border border-slate-200 text-slate-600"
                  }`}
                  onClick={() => void onToggleFavorite(!currentImage.is_favorite)}
                  disabled={pending}
                  aria-label={
                    currentImage.is_favorite
                      ? "お気に入りを解除"
                      : "お気に入りに追加"
                  }
                >
                  {currentImage.is_favorite ? "解除する" : "追加する"}
                </button>
              </div>
            </section>

            <dl className="grid gap-3 text-sm">
              <InfoRow label="解像度" value={formatDimensions(currentImage.width, currentImage.height)} />
              <InfoRow label="サイズ" value={formatBytes(currentImage.size_bytes)} />
              <InfoRow label="MIME type" value={currentImage.mime_type} />
              <InfoRow label="登録日時" value={formatDateTime(currentImage.created_at)} />
              <InfoRow label="所属フォルダー" value={currentImage.folder_name ?? "未分類"} />
              <InfoRow label="お気に入り" value={currentImage.is_favorite ? "ON" : "OFF"} />
            </dl>
          </div>

          <div className="mt-auto space-y-3 pt-6">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onOpenFullscreen}
              disabled={pending}
              aria-label="全画面表示を開く"
            >
              全画面表示
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onPrevious}
                disabled={isFirst || pending}
                aria-label="前の画像へ移動"
              >
                前へ
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onNext}
                disabled={isLast || pending}
                aria-label="次の画像へ移動"
              >
                次へ
              </button>
            </div>

            <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-700">画像を削除</p>
              <p className="mt-2 text-sm leading-6 text-rose-600">
                元に戻せません。Storage とデータベースの両方から削除します。
              </p>
              <div className="mt-4 flex gap-3">
                {isDeleteConfirming ? (
                  <>
                    <button
                      type="button"
                      className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setIsDeleteConfirming(false)}
                      disabled={pending}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onDelete()}
                      disabled={pending}
                      aria-label="この画像を削除"
                    >
                      本当に削除する
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setIsDeleteConfirming(true)}
                    disabled={pending}
                    aria-label="画像削除の確認を開く"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</dt>
      <dd className="break-all font-medium text-ink">{value}</dd>
    </div>
  );
}
