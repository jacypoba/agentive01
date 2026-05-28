import { NextResponse } from "next/server";
import { getWhatsAppInboundDiagnostics } from "@/lib/evolution/inbound-diagnostics";

export async function GET() {
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
