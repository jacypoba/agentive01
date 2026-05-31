import { NextResponse } from "next/server";
import { buildMetaMessageStatusReport } from "@/lib/meta/message-status-debug";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";
import { getAppUrl } from "@/lib/stripe/app-url";

const ROUTE = "/api/debug/meta-message-status";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId")?.trim() ?? null;
  const templateName = url.searchParams.get("template")?.trim() ?? null;

  try {
    const report = await buildMetaMessageStatusReport({ messageId, templateName });

    return NextResponse.json({
      ...report,
      endpoints: {
        metaWebhook: `${getAppUrl()}/api/webhooks/meta`,
        whatsappHealth: `${getAppUrl()}/api/debug/whatsapp-health?ping=1&metaOnly=1`,
      },
      notes: [
        "Protected: CRON_SECRET (Bearer or x-cron-secret) or workspace owner/admin.",
        "Optional ?messageId=wamid... to correlate with a specific send.",
        "Optional ?template=order_confirmation to inspect template approval status.",
        "Agentive01 outbound uses type=text — use Meta Console template send or add template send for cold outbound tests.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build Meta message status report.",
      },
      { status: 500 }
    );
  }
}
