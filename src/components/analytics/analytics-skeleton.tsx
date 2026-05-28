export function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-[108px] rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="h-[320px] rounded-2xl border border-white/10 bg-white/[0.03] xl:col-span-2" />
        <div className="h-[320px] rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[300px] rounded-2xl border border-white/10 bg-white/[0.03]" />
        <div className="h-[300px] rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>
    </div>
  );
}
