import { NextResponse } from "next/server";
import { processPendingFollowUps } from "@/lib/follow-ups/processor";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Set Authorization: Bearer <CRON_SECRET> or run in non-production without CRON_SECRET.",
      },
      { status: 401 }
    );
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
