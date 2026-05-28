import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deploy debug — Agentive01",
  robots: "noindex, nofollow",
};

const DEPLOY_LABEL = "e2f5f61-calendar-check";

const ROUTES = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
  "/leads",
  "/visits",
  "/properties",
  "/settings",
  "/settings/calendar",
  "/debug-deploy",
  "/api/integrations/google/connect",
  "/api/integrations/google/callback",
  "/api/webhooks/evolution",
];

export default function DebugDeployPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Deploy debug</h1>
      <p className="mt-2 text-sm text-white/50">
        Temporary page to verify which repo/branch/commit Vercel is serving.
      </p>

      <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/70">
          Deploy label
        </p>
        <p className="mt-2 font-mono text-lg text-emerald-200">{DEPLOY_LABEL}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">
          Git (expected)
        </p>
        <ul className="mt-3 space-y-2 font-mono text-sm text-white/70">
          <li>remote: https://github.com/jacypoba/agentive01.git</li>
          <li>branch: main</li>
          <li>commit: e2f5f611a71b92de2b28ab6581867ba668809547</li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">
          Routes note
        </p>
        <p className="mt-2 text-sm text-white/60">
          If you see this page, Vercel deployed this repo after the debug commit.
          Calendar settings should be at{" "}
          <a href="/settings/calendar" className="text-[#00D4FF] hover:underline">
            /settings/calendar
          </a>
          .
        </p>
        <ul className="mt-4 space-y-1 font-mono text-xs text-white/45">
          {ROUTES.map((route) => (
            <li key={route}>{route}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
