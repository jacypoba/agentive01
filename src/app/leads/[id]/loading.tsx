export default function LeadDetailLoading() {
  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-5 w-32 rounded bg-white/5" />

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div className="h-8 w-40 rounded bg-white/10" />
              <div className="h-6 w-16 rounded-full bg-white/10" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="h-12 rounded bg-white/5" />
              <div className="h-16 rounded bg-white/5" />
              <div className="h-12 rounded bg-white/5" />
            </div>
          </aside>

          <section className="flex h-[min(70vh,640px)] flex-col rounded-2xl border border-white/10 bg-[#0a0a0a]/90 lg:col-span-2">
            <div className="border-b border-white/10 px-5 py-3">
              <div className="h-5 w-28 rounded bg-white/10" />
            </div>
            <div className="flex-1 space-y-4 p-5">
              <div className="h-16 w-3/4 rounded-2xl bg-white/5" />
              <div className="ml-auto h-16 w-2/3 rounded-2xl bg-white/10" />
              <div className="h-16 w-3/5 rounded-2xl bg-white/5" />
            </div>
            <div className="border-t border-white/10 p-5">
              <div className="h-12 rounded-xl bg-white/5" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
