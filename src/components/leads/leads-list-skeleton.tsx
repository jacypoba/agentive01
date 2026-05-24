export function LeadsListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-12 flex-1 rounded-xl border border-white/10 bg-white/5 sm:max-w-md" />
        <div className="h-10 w-36 rounded-full border border-white/10 bg-white/5" />
      </div>

      <div className="h-4 w-32 rounded bg-white/5" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/5" />
                <div className="h-4 w-2/3 rounded bg-white/5" />
              </div>
              <div className="h-6 w-16 rounded-full bg-white/10" />
            </div>
            <div className="mt-5 space-y-2 border-t border-white/5 pt-4">
              <div className="h-3 w-1/2 rounded bg-white/5" />
              <div className="h-3 w-2/3 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
