type EmptyStateProps = {
  title: string;
  description: string;
  hint?: string;
};

export function EmptyState({ title, description, hint }: EmptyStateProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center shadow-soft">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Empty</p>
      <p className="mt-3 text-xl font-semibold text-ink">{title}</p>
      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{description}</p>
      {hint ? <p className="mt-4 text-xs leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}
