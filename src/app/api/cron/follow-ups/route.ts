import { NextResponse } from "next/server";
import { processDueFollowUps } from "@/lib/follow-ups/processor";
import { scanSilentLeadsForFollowUp } from "@/lib/follow-ups/triggers";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const userId = process.env.WHATSAPP_DEFAULT_USER_ID;

    if (userId) {
      await scanSilentLeadsForFollowUp(supabase, userId);
    }

    const result = await processDueFollowUps(supabase);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      scannedUserId: userId ?? null,
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
