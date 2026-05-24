import { LeadsListSkeleton } from "@/components/leads/leads-list-skeleton";

export default function LeadsLoading() {
  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="animate-pulse">
          <div className="mb-4 h-8 w-40 rounded-full bg-white/5" />
          <div className="h-10 w-64 rounded bg-white/10" />
          <div className="mt-3 h-5 w-96 max-w-full rounded bg-white/5" />
        </section>
        <section className="mt-10">
          <LeadsListSkeleton />
        </section>
      </div>
    </main>
  );
}
