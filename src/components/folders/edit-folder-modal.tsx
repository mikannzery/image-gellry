"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { FolderRow } from "@/types/folder";

type EditFolderModalProps = {
  folder: FolderRow | null;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export function EditFolderModal({
  folder,
  pending = false,
  onClose,
  onSubmit,
}: EditFolderModalProps) {
  const [name, setName] = useState(folder?.name ?? "");
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setName(folder?.name ?? "");
  }, [folder]);

  useEffect(() => {
    if (!folder) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [folder, pending, onClose]);

  if (!folder) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(name);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
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
        className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-soft"
      >
        <div className="space-y-2">
          <h3 id={titleId} className="text-xl font-semibold text-ink">
            フォルダー名を変更
          </h3>
          <p id={descriptionId} className="text-sm leading-7 text-slate-600">
            フォルダー名のみを変更します。画像や並び順には影響しません。
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={pending}
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onClose}
              disabled={pending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
            >
              {pending ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
