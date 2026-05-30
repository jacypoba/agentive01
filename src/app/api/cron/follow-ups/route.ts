import { NextResponse } from "next/server";
import { processDueFollowUps } from "@/lib/follow-ups/processor";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";

const ROUTE = "/api/cron/follow-ups";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE, {
    allowWorkspaceAdmin: false,
  });
  if (denied) {
    return denied;
  }

  try {
    const supabase = createAdminClient();
    const result = await processDueFollowUps(supabase);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "follow_up_cron_failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
