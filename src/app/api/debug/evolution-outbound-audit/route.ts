import { NextResponse } from "next/server";
import { auditEvolutionOutboundRootCause } from "@/lib/evolution/outbound-root-cause-audit";

export async function GET() {
  try {
    const audit = await auditEvolutionOutboundRootCause();
    return NextResponse.json(audit);
  } catch (error) {
    return NextResponse.json(
      {
        debugLabel: "evolution-outbound-root-cause-v1",
        error:
          error instanceof Error
            ? error.message
            : "Failed to run Evolution outbound root cause audit.",
      },
      { status: 500 }
    );
  }
}
