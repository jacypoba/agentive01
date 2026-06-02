import { NextResponse } from "next/server";
import { buildEvolutionWebhookAuthSummary } from "@/lib/evolution/evolution-webhook-auth";
import { syncEvolutionWebhookConfiguration } from "@/lib/evolution/evolution-webhook-sync";
import { getWhatsAppInboundDiagnostics } from "@/lib/evolution/inbound-diagnostics";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";

const ROUTE = "/api/debug/whatsapp-inbound";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const syncWebhook = url.searchParams.get("syncWebhook") === "1";

  try {
    const diagnostics = await getWhatsAppInboundDiagnostics();
    const webhookAuth = buildEvolutionWebhookAuthSummary();
    const webhookSync = syncWebhook ? await syncEvolutionWebhookConfiguration() : null;

    return NextResponse.json({
      ...diagnostics,
      webhookAuth,
      webhookSync,
    });
  } catch (error) {
    return NextResponse.json(
      {
        debugLabel: "whatsapp-inbound-v1",
        error:
          error instanceof Error
            ? error.message
            : "Failed to load WhatsApp inbound diagnostics.",
      },
      { status: 500 }
    );
  }
}
