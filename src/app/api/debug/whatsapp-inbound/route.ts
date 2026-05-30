import { NextResponse } from "next/server";
import { getWhatsAppInboundDiagnostics } from "@/lib/evolution/inbound-diagnostics";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";

const ROUTE = "/api/debug/whatsapp-inbound";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  try {
    const diagnostics = await getWhatsAppInboundDiagnostics();
    return NextResponse.json(diagnostics);
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
