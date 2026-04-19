"use client";

import { useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  intent?: "danger" | "default";
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  intent = "default",
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, pending, onClose]);

  if (!open) {
    return null;
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
        <div className="space-y-3">
          <h3 id={titleId} className="text-xl font-semibold text-ink">
            {title}
          </h3>
          <p id={descriptionId} className="text-sm leading-7 text-slate-600">
            {description}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={pending}
            aria-label="確認ダイアログを閉じる"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${
              intent === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-ink hover:bg-slate-800"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            onClick={onConfirm}
            disabled={pending}
            aria-label={confirmLabel}
          >
            {pending ? "処理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
