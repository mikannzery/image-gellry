type LoadingStateProps = {
  message?: string;
  compact?: boolean;
};

export function LoadingState({ message, compact = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="rounded-[28px] border border-slate-200 bg-white/85 p-6 shadow-soft"
    >
      <div className="flex animate-pulse flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-accent/60" />
          <div className="h-4 w-40 rounded-full bg-slate-200" />
        </div>
        <div className={`grid gap-4 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
          {Array.from({ length: compact ? 3 : 6 }).map((_, index) => (
            <div key={index} className={`rounded-[24px] bg-slate-100 ${compact ? "h-28" : "h-48"}`} />
          ))}
        </div>
      </div>
      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
