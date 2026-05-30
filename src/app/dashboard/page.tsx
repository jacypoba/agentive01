import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsSection } from "@/components/analytics/analytics-section";
import { CalendarVisitsPanel } from "@/components/dashboard/calendar-visits-panel";
import { CreateTestLeadButton } from "@/components/dashboard/create-test-lead-button";
import { FollowUpsPanel } from "@/components/dashboard/follow-ups-panel";
import { WhatsAppLiveFeed } from "@/components/dashboard/whatsapp-live-feed";
import { VisitRequestsPanel } from "@/components/visits/visit-requests-panel";
import { createClient } from "@/lib/supabase/server";
import { parseAnalyticsPeriod } from "@/lib/analytics/periods";
import {
  formatRelativeTime,
  getActivityLabel,
  getDashboardData,
  getStatusBadgeColor,
} from "@/lib/data/dashboard";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";

export const metadata: Metadata = {
  title: "Dashboard — Agentive01",
  description: "Your Agentive01 command center.",
};

const quickActions = [
  {
    title: "Calendar settings",
    description: "Connect Google Calendar and set visit hours.",
    href: "/settings/calendar",
    badge: "Calendar",
  },
  {
    title: "Train your AI",
    description: "Configure tone, FAQs, and agency voice for WhatsApp.",
    href: "/settings/ai",
    badge: "Configure",
  },
  {
    title: "Visit requests",
    description: "Review and confirm pending property visits.",
    href: "/visits",
    badge: "Visits",
  },
  {
    title: "Follow-ups",
    description: "Review and send automated WhatsApp re-engagement.",
    href: "/follow-ups",
    badge: "Follow-ups",
  },
  {
    title: "View leads",
    description: "Browse and search your full leads pipeline.",
    href: "/leads",
    badge: "Pipeline",
  },
];

type DashboardPageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const analyticsPeriod = parseAnalyticsPeriod(params.period);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dashboardData = null;
  let dbError: string | null = null;
  let activeWorkspaceId: string | null = null;

  if (user) {
    try {
      const { userId, workspaceId } = await resolveTenantScope(supabase, user.id);
      activeWorkspaceId = workspaceId;
      dashboardData = await getDashboardData(supabase, userId, workspaceId);
    } catch (error) {
      dbError =
        error instanceof Error
          ? error.message
          : "Could not load dashboard data.";
    }
  }

  const displayName =
    dashboardData?.profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "there";

  const stats = dashboardData
    ? [
        {
          label: "Active conversations",
          value: String(dashboardData.stats.recentConversations),
          change: "Last 7 days",
          accent: "text-[#00D4FF]",
          href: "/leads",
        },
        {
          label: "Leads qualified",
          value: String(dashboardData.stats.qualifiedLeads),
          change: `${dashboardData.stats.totalLeads} total leads`,
          accent: "text-white",
          href: "/leads?status=qualified",
        },
        {
          label: "Pending visits",
          value: String(dashboardData.stats.pendingVisitRequests),
          change: `${dashboardData.stats.scheduledLeads} confirmed on calendar`,
          accent: "text-amber-300",
          href: "/visits?status=pending",
        },
        {
          label: "Pending follow-ups",
          value: String(dashboardData.stats.pendingFollowUps),
          change: `${dashboardData.stats.sentFollowUpsToday} sent today`,
          accent: "text-[#00D4FF]",
          href: "/follow-ups?group=pending",
        },
        {
          label: "Sent follow-ups today",
          value: String(dashboardData.stats.sentFollowUpsToday),
          change: "WhatsApp re-engagement",
          accent: "text-emerald-300",
          href: "/follow-ups?group=sent",
        },
        {
          label: "Total pipeline",
          value: String(dashboardData.stats.totalLeads),
          change: "All captured leads",
          accent: "text-white",
          href: "/leads",
        },
      ]
    : [];

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="animate-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D4FF] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D4FF]" />
            </span>
            Dashboard · Live
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Good to see you,{" "}
            <span className="bg-gradient-to-r from-[#00D4FF] via-[#0066FF] to-[#00D4FF] bg-clip-text text-transparent">
              {displayName}
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-white/50">
            Your AI employees are standing by. Here&apos;s what&apos;s happening
            across your WhatsApp pipeline today.
          </p>
        </section>

        {dbError && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200"
          >
            <p className="font-medium">Database not ready</p>
            <p className="mt-1 text-amber-200/80">
              Run the migration in{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                supabase/migrations/001_initial_schema.sql
              </code>{" "}
              via the Supabase SQL Editor, then refresh this page.
            </p>
            <p className="mt-2 text-xs text-amber-200/60">{dbError}</p>
          </div>
        )}

        {dashboardData && (
          <>
            <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="group block rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 hover:shadow-lg hover:shadow-[#0066FF]/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/50"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-white/40 transition-colors group-hover:text-white/55">
                    {stat.label}
                  </p>
                  <p
                    className={`mt-3 text-3xl font-semibold tracking-tight ${stat.accent}`}
                  >
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs text-white/40 transition-colors group-hover:text-white/55">
                    {stat.change}
                  </p>
                </Link>
              ))}
            </section>

            {user && activeWorkspaceId && (
              <AnalyticsSection
                userId={user.id}
                workspaceId={activeWorkspaceId}
                period={analyticsPeriod}
              />
            )}

            <section className="mt-12 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold">Recent activity</h2>
                  <CreateTestLeadButton />
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
                  {dashboardData.recentActivity.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <p className="text-sm text-white/50">No activity yet</p>
                      <p className="mt-1 text-xs text-white/30">
                        Create a test lead to see your pipeline in action.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {dashboardData.recentActivity.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">
                              {item.client_name}
                            </p>
                            <p className="mt-1 truncate text-xs text-white/40">
                              {getActivityLabel(item)} · {item.message}
                            </p>
                            <p className="mt-1 text-[10px] text-white/30">
                              {formatRelativeTime(item.created_at)}
                            </p>
                          </div>
                          <span
                            className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeColor(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold">Quick actions</h2>
                <div className="mt-4 space-y-3">
                  {quickActions.map((action) => (
                    <Link
                      key={action.title}
                      href={action.href}
                      className="group block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {action.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-white/50">
                            {action.description}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50 transition-colors group-hover:border-[#00D4FF]/30 group-hover:text-[#00D4FF]">
                          {action.badge}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            {user && (
              <CalendarVisitsPanel buckets={dashboardData.calendarBuckets} />
            )}

            {user && (
              <VisitRequestsPanel visits={dashboardData.recentVisitRequests} />
            )}

            {user && (
              <FollowUpsPanel buckets={dashboardData.followUpBuckets} />
            )}

            {user && (
              <WhatsAppLiveFeed
                userId={user.id}
                initialActivity={dashboardData.recentActivity}
              />
            )}
          </>
        )}

        <section className="relative mt-12 overflow-hidden rounded-3xl border border-white/10">
          <div className="relative bg-gradient-to-br from-[#0066FF]/15 via-[#0a0a0a] to-black px-8 py-10 sm:px-12">
            <h2 className="text-xl font-semibold sm:text-2xl">
              Your business never sleeps
            </h2>
            <p className="mt-2 max-w-lg text-sm text-white/50">
              Signed in as{" "}
              <span className="text-white/80">
                {dashboardData?.profile?.email ?? user?.email}
              </span>
              . AI employees are ready to qualify leads on WhatsApp around the
              clock.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:border-white/25 hover:bg-white/10"
            >
              Back to marketing site
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
