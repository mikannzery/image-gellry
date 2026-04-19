"use client";

import { useId, useState } from "react";

type UploadDropzoneProps = {
  pending?: boolean;
  onFiles: (files: File[]) => Promise<void>;
};

export function UploadDropzone({ pending = false, onFiles }: UploadDropzoneProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (pending) {
      return;
    }

    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      return;
    }

    await onFiles(files);
  }

  return (
    <div
      className={`rounded-xl border border-dashed px-5 py-8 transition ${
        pending
          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
          : isDragging
            ? "border-slate-300 bg-slate-50"
            : "border-slate-200 bg-[#fcfcfd]"
      }`}
      aria-disabled={pending}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!pending) {
          setIsDragging(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!pending) {
          setIsDragging(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={async (event) => {
        event.preventDefault();
        setIsDragging(false);
        await handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-4 text-slate-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 16V4M12 4L7.5 8.5M12 4L16.5 8.5M5 15.5V18C5 19.1046 5.89543 20 7 20H17C18.1046 20 19 19.1046 19 18V15.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">画像をドラッグアンドドロップ</h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">またはクリックして選択</p>
        <p className="mt-1.5 text-xs text-slate-500">対応形式: png / jpg / jpeg / webp ・ 1ファイル20MBまで</p>
        <label
          htmlFor={inputId}
          className={`mt-4 inline-flex items-center justify-center rounded-md border px-3.5 py-2 text-sm font-medium transition ${
            pending
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "cursor-pointer border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          ファイルを選択
        </label>
        <input
          id={inputId}
          className="hidden"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          multiple
          onChange={async (event) => {
            await handleFiles(event.target.files);
            event.currentTarget.value = "";
          }}
          disabled={pending}
        />
      </div>
    </div>
  );
}
