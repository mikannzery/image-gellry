"use client";

import { useEffect } from "react";

type ClipboardPasteZoneProps = {
  enabled?: boolean;
  onFiles: (files: File[]) => Promise<void>;
};

export function ClipboardPasteZone({
  enabled = true,
  onFiles,
}: ClipboardPasteZoneProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    async function handlePaste(event: ClipboardEvent) {
      const activeElement = document.activeElement;

      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      await onFiles(files);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [enabled, onFiles]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600">
      <span className="font-medium text-slate-900">クリップボードから貼り付け:</span>{" "}
      ページ上で <span className="font-semibold text-slate-900">Ctrl + V</span> または{" "}
      <span className="font-semibold text-slate-900">Cmd + V</span> を押すと、クリップボードの画像も貼り付けできます。
      {!enabled ? (
        <p className="mt-1 text-[11px] text-slate-500" role="status" aria-live="polite">
          処理中のため、貼り付けは一時停止しています。
        </p>
      ) : null}
    </div>
  );
}
