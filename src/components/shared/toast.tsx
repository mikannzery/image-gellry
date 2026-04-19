"use client";

import { cn } from "@/lib/utils/format";

export type ToastItem = {
  id: string;
  variant: "success" | "error" | "info";
  message: string;
};

const variantStyles: Record<ToastItem["variant"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-slate-200 bg-white text-slate-800",
};

export function ToastStack({ items }: { items: ToastItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed right-4 top-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3"
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.variant === "error" ? "alert" : "status"}
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm shadow-soft backdrop-blur",
            variantStyles[item.variant],
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
