import { NextResponse } from "next/server";
import { auditEvolutionOutboundRootCause } from "@/lib/evolution/outbound-root-cause-audit";
import { redactConnectionSnapshot } from "@/lib/security/redact-debug-response";
import { guardOperationalRoute } from "@/lib/security/operational-endpoint-auth";

const ROUTE = "/api/debug/evolution-outbound-audit";

export async function GET(request: Request) {
  const denied = await guardOperationalRoute(request, ROUTE);
  if (denied) {
    return denied;
  }

  try {
    const audit = await auditEvolutionOutboundRootCause();
    return NextResponse.json({
      ...audit,
      connection: redactConnectionSnapshot(audit.connection),
      webhook: {
        ...audit.webhook,
        configuredUrl: audit.webhook.configuredUrl ? "[redacted]" : null,
      },
    });
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
