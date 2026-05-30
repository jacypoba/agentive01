import { NextResponse } from "next/server";
import { processPendingFollowUps } from "@/lib/follow-ups/processor";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";

const ROUTE = "/api/test/follow-ups";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  console.log("[Test follow-ups] Manual run started");

  try {
    const supabase = createAdminClient();
    const result = await processPendingFollowUps(supabase, { dueOnly: false });

    const sent = result.details.filter((item) => item.outcome === "sent");
    const failed = result.details.filter((item) => item.outcome === "failed");
    const skipped = result.details.filter(
      (item) => item.outcome === "skipped" || item.outcome === "cancelled"
    );

    console.log("[Test follow-ups] Processed follow-ups:", {
      total: result.processed,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    });

    if (sent.length > 0) {
      console.log("[Test follow-ups] Sent messages:", sent);
    }

    if (failed.length > 0) {
      console.log("[Test follow-ups] Failed messages:", failed);
    }

    if (skipped.length > 0) {
      console.log("[Test follow-ups] Skipped/cancelled:", skipped);
    }

    console.log("[Test follow-ups] Manual run finished");

    return NextResponse.json({
      ok: true,
      mode: "test",
      timestamp: new Date().toISOString(),
      note: "Processes all pending follow-ups immediately (ignores scheduled_for). Production cron unchanged.",
      summary: {
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      },
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("[Test follow-ups] Manual run failed", {
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        ok: false,
        mode: "test",
        error: error instanceof Error ? error.message : "test_follow_up_failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
