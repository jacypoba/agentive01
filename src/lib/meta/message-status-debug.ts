import {
  getInboundHeartbeat,
  getOutboundHeartbeat,
} from "@/lib/evolution/whatsapp-heartbeat";
import { getOutboundHealthSnapshot } from "@/lib/evolution/outbound-health";
import { isMetaWhatsAppConfigured } from "@/lib/whatsapp/config";

export type MetaGraphFetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; raw?: string };

export type MetaPhoneNumberFields = {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  status?: string;
  code_verification_status?: string;
  messaging_limit_tier?: string;
  platform_type?: string;
  account_mode?: string;
  is_official_business_account?: boolean;
  name_status?: string;
  new_name_status?: string;
};

export type MetaMessageTemplateRow = {
  name?: string;
  status?: string;
  category?: string;
  language?: string;
  id?: string;
  rejected_reason?: string;
};

export type MetaWabaFields = {
  id?: string;
  name?: string;
  account_review_status?: string;
  message_template_namespace?: string;
  timezone_id?: string;
};

const META_ERROR_HINTS: Record<number, string> = {
  131026: "Message undeliverable — recipient may be invalid, blocked, or not on WhatsApp.",
  131047:
    "Re-engagement required — outside the 24-hour window; send an approved template instead of free-form text.",
  131049: "Meta chose not to deliver this marketing message to the user.",
  131042:
    "Business eligibility / billing issue — attach a valid payment method to the WABA.",
  131051: "Unsupported message type for this recipient/session.",
  130472: "Recipient number is in a Meta experiment group.",
  63016: "More than 24 hours since the user last replied — template required.",
  63024: "Invalid recipient phone number format or not a WhatsApp user.",
  133010: "Phone number not registered on Cloud API — call POST /{phone-number-id}/register.",
};

function getMetaGraphConfig() {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";
  const wabaId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ?? null;

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "Meta Cloud API is not configured. Set META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID."
    );
  }

  return { accessToken, phoneNumberId, graphVersion, wabaId };
}

async function metaGraphGet<T>(
  path: string,
  query?: Record<string, string>
): Promise<MetaGraphFetchResult<T>> {
  const { accessToken, graphVersion } = getMetaGraphConfig();
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) {
    let error = `Graph API ${response.status}`;
    try {
      const json = JSON.parse(raw) as {
        error?: { message?: string; code?: number };
      };
      if (json.error?.message) {
        error = `${json.error.message}${json.error.code ? ` (code ${json.error.code})` : ""}`;
      }
    } catch {
      // keep generic error
    }
    return { ok: false, status: response.status, error, raw };
  }

  try {
    return {
      ok: true,
      status: response.status,
      data: JSON.parse(raw) as T,
    };
  } catch {
    return { ok: false, status: response.status, error: "Invalid JSON from Graph API.", raw };
  }
}

export async function fetchMetaPhoneNumberProfile(): Promise<
  MetaGraphFetchResult<MetaPhoneNumberFields>
> {
  const { phoneNumberId } = getMetaGraphConfig();
  return metaGraphGet<MetaPhoneNumberFields>(phoneNumberId, {
    fields:
      "id,display_phone_number,verified_name,quality_rating,status,code_verification_status,messaging_limit_tier,platform_type,account_mode,is_official_business_account,name_status,new_name_status",
  });
}

export async function fetchMetaWabaProfile(): Promise<
  MetaGraphFetchResult<MetaWabaFields> | null
> {
  const wabaId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (!wabaId) {
    return null;
  }

  return metaGraphGet<MetaWabaFields>(wabaId, {
    fields: "id,name,account_review_status,message_template_namespace,timezone_id",
  });
}

export async function fetchMetaMessageTemplates(
  templateName?: string | null
): Promise<MetaGraphFetchResult<{ data?: MetaMessageTemplateRow[] }> | null> {
  const wabaId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (!wabaId) {
    return null;
  }

  const query: Record<string, string> = {
    fields: "name,status,category,language,id,rejected_reason",
    limit: "50",
  };

  if (templateName?.trim()) {
    query.name = templateName.trim();
  }

  return metaGraphGet<{ data?: MetaMessageTemplateRow[] }>(
    `${wabaId}/message_templates`,
    query
  );
}

export type MetaDeliveryDiagnosis = {
  primaryCause: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  checks: Array<{ id: string; status: "pass" | "warn" | "fail" | "unknown"; detail: string }>;
  nextSteps: string[];
};

function addCheck(
  checks: MetaDeliveryDiagnosis["checks"],
  id: string,
  status: MetaDeliveryDiagnosis["checks"][number]["status"],
  detail: string
) {
  checks.push({ id, status, detail });
}

export function buildMetaDeliveryDiagnosis(input: {
  phoneNumber: MetaGraphFetchResult<MetaPhoneNumberFields> | null;
  waba: MetaGraphFetchResult<MetaWabaFields> | null;
  templates: MetaGraphFetchResult<{ data?: MetaMessageTemplateRow[] }> | null;
  outboundHeartbeat: Awaited<ReturnType<typeof getOutboundHeartbeat>>;
  inboundHeartbeat: Awaited<ReturnType<typeof getInboundHeartbeat>>;
  runtimeOutbound: ReturnType<typeof getOutboundHealthSnapshot>;
  messageId?: string | null;
  appSendType: "text" | "template" | "unknown";
}): MetaDeliveryDiagnosis {
  const checks: MetaDeliveryDiagnosis["checks"] = [];
  const nextSteps: string[] = [];

  const deliveryStatus =
    input.outboundHeartbeat?.last_delivery_status?.toUpperCase() ?? null;
  const lastError = input.outboundHeartbeat?.last_error ?? null;
  const lastMessageId =
    input.messageId ??
    input.outboundHeartbeat?.last_evolution_message_id ??
    input.runtimeOutbound.lastSuccess?.evolutionMessageId ??
    null;

  addCheck(
    checks,
    "graph_api_acceptance_vs_delivery",
    "warn",
    "Meta Graph API HTTP 200 + wamid + message_status=accepted only means Meta queued the message. Delivery requires webhook statuses sent/delivered or failed."
  );

  if (input.appSendType === "text") {
    addCheck(
      checks,
      "business_initiated_text_without_session",
      "fail",
      "Agentive01 health ping and AI replies send type=text. For business-initiated contact outside the 24-hour customer service window, Meta requires an approved template message — free-form text is rejected or never delivered."
    );
    nextSteps.push(
      "Have the recipient send any WhatsApp message to your business number first, then retry within 24 hours."
    );
    nextSteps.push(
      "For cold outbound/tests, send an approved template (e.g. hello_world or your Order Confirmation template) via Graph API type=template — not type=text."
    );
  }

  if (!input.inboundHeartbeat?.last_webhook_received_at) {
    addCheck(
      checks,
      "webhook_inbound_configured",
      "warn",
      "No inbound Meta webhook heartbeat recorded. Configure POST /api/webhooks/meta in Meta Developer Console and subscribe to messages + message_status fields."
    );
    nextSteps.push(
      "In Meta Developer Console → WhatsApp → Configuration, set Callback URL to https://<your-domain>/api/webhooks/meta and verify META_WHATSAPP_VERIFY_TOKEN + META_WHATSAPP_APP_SECRET."
    );
  } else {
    addCheck(
      checks,
      "webhook_inbound_configured",
      "pass",
      `Last Meta webhook received at ${input.inboundHeartbeat.last_webhook_received_at}.`
    );
  }

  if (!deliveryStatus) {
    addCheck(
      checks,
      "webhook_status_updates",
      "warn",
      "No delivery status webhook recorded for the latest outbound message. Without status webhooks you cannot distinguish accepted vs delivered vs failed."
    );
    nextSteps.push(
      "Confirm webhook subscriptions include message_status (and messages). Send a test, then re-check this endpoint."
    );
  } else if (deliveryStatus === "FAILED" || deliveryStatus === "ERROR") {
    addCheck(
      checks,
      "webhook_status_updates",
      "fail",
      `Latest webhook delivery status: ${deliveryStatus}${lastError ? ` — ${lastError}` : ""}.`
    );
  } else if (deliveryStatus === "SENT" || deliveryStatus === "DELIVERED" || deliveryStatus === "READ") {
    addCheck(
      checks,
      "webhook_status_updates",
      "pass",
      `Latest webhook delivery status: ${deliveryStatus}. If the phone still shows nothing, verify the recipient device and number.`
    );
  } else {
    addCheck(
      checks,
      "webhook_status_updates",
      "warn",
      `Latest webhook delivery status: ${deliveryStatus}.`
    );
  }

  const phone = input.phoneNumber?.ok ? input.phoneNumber.data : null;
  if (input.phoneNumber && !input.phoneNumber.ok) {
    addCheck(
      checks,
      "sender_phone_number_active",
      "fail",
      `Could not load phone number profile: ${input.phoneNumber.error}`
    );
  } else if (phone) {
    const phoneStatus = phone.status?.toUpperCase() ?? "UNKNOWN";
    if (phoneStatus === "CONNECTED") {
      addCheck(
        checks,
        "sender_phone_number_active",
        "pass",
        `Sender ${phone.display_phone_number ?? phone.id} status=${phone.status}, tier=${phone.messaging_limit_tier ?? "unknown"}.`
      );
    } else {
      addCheck(
        checks,
        "sender_phone_number_active",
        "fail",
        `Sender phone status=${phone.status ?? "unknown"} (expected CONNECTED). Verify registration in WhatsApp Manager.`
      );
      nextSteps.push(
        "In WhatsApp Manager, confirm the phone number is Connected. If needed, POST /{phone-number-id}/register with your two-step verification PIN."
      );
    }

    if (phone.code_verification_status && phone.code_verification_status !== "VERIFIED") {
      addCheck(
        checks,
        "sender_number_verified",
        "warn",
        `code_verification_status=${phone.code_verification_status}.`
      );
    }
  } else {
    addCheck(checks, "sender_phone_number_active", "unknown", "Phone number profile not fetched.");
  }

  const waba = input.waba?.ok ? input.waba.data : null;
  if (input.waba && !input.waba.ok) {
    addCheck(
      checks,
      "waba_review_status",
      "warn",
      `Could not load WABA profile: ${input.waba.error}`
    );
  } else if (waba) {
    addCheck(
      checks,
      "waba_review_status",
      waba.account_review_status === "APPROVED" ? "pass" : "warn",
      `WABA account_review_status=${waba.account_review_status ?? "unknown"}.`
    );
    if (waba.account_review_status !== "APPROVED") {
      nextSteps.push(
        "Complete Business Verification in Meta Business Manager. Development-mode apps can only message test recipients until approved."
      );
    }
  } else {
    addCheck(
      checks,
      "waba_review_status",
      "unknown",
      "Set META_WHATSAPP_BUSINESS_ACCOUNT_ID to inspect WABA review status and templates."
    );
  }

  if (input.templates?.ok) {
    const rows = input.templates.data.data ?? [];
    const approved = rows.filter((row) => row.status === "APPROVED");
    const orderConfirmation = rows.find((row) =>
      /order.?confirmation/i.test(row.name ?? "")
    );

    addCheck(
      checks,
      "approved_templates_available",
      approved.length > 0 ? "pass" : "fail",
      approved.length > 0
        ? `${approved.length} approved template(s): ${approved.map((row) => row.name).join(", ")}.`
        : "No approved templates returned for this WABA."
    );

    if (orderConfirmation) {
      addCheck(
        checks,
        "order_confirmation_template",
        orderConfirmation.status === "APPROVED" ? "pass" : "fail",
        `Template "${orderConfirmation.name}" status=${orderConfirmation.status ?? "unknown"}${orderConfirmation.rejected_reason ? ` (${orderConfirmation.rejected_reason})` : ""}.`
      );
    } else {
      addCheck(
        checks,
        "order_confirmation_template",
        "warn",
        "No template matching 'order confirmation' found. Console sample templates may use a different exact name/language code."
      );
    }

    if (approved.length === 0) {
      nextSteps.push(
        "Submit and get a template approved (start with Meta sample hello_world), then send type=template for business-initiated tests."
      );
    }
  } else if (input.templates === null) {
    addCheck(
      checks,
      "approved_templates_available",
      "unknown",
      "Template list not fetched — set META_WHATSAPP_BUSINESS_ACCOUNT_ID."
    );
  } else {
    addCheck(
      checks,
      "approved_templates_available",
      "fail",
      `Template list failed: ${input.templates.error}`
    );
  }

  addCheck(
    checks,
    "development_mode_recipients",
    "warn",
    "If the Meta app is in Development mode, each test recipient must be added under WhatsApp → API Setup → 'To' phone numbers (max 5). Production Live mode removes this restriction after Business Verification."
  );
  nextSteps.push(
    "In Meta Developer Console → WhatsApp → API Setup, add every test recipient E.164 number to the allowed 'To' list while the app is in Development."
  );

  addCheck(
    checks,
    "billing_eligibility",
    "warn",
    "Template and some utility/marketing messages require a valid payment method on the WABA even during testing. Watch webhooks for error 131042 (business eligibility payment issue)."
  );
  nextSteps.push(
    "In Meta Business Manager → WhatsApp Manager → Billing, attach a payment method and confirm no outstanding balance or eligibility holds."
  );

  let primaryCause = "accepted_not_delivered_unknown";
  let confidence: MetaDeliveryDiagnosis["confidence"] = "medium";
  let summary =
    "Meta accepted the message (wamid returned) but delivery was not confirmed. Inspect webhook status updates and template/session rules.";

  if (deliveryStatus === "FAILED" || deliveryStatus === "ERROR") {
    primaryCause = "meta_webhook_reported_failed";
    confidence = "high";
    summary = `Meta webhook reported delivery failure${lastError ? `: ${lastError}` : ""}.`;
  } else if (phone && phone.status && phone.status.toUpperCase() !== "CONNECTED") {
    primaryCause = "sender_phone_not_connected";
    confidence = "high";
    summary = `Business phone number is not CONNECTED (status=${phone.status}).`;
  } else if (
    input.appSendType === "text" &&
    deliveryStatus !== "DELIVERED" &&
    deliveryStatus !== "READ" &&
    deliveryStatus !== "SENT"
  ) {
    primaryCause = "business_initiated_text_outside_24h_window";
    confidence = "high";
    summary =
      "Most likely cause: Agentive01 sent a free-form text message. Meta accepts it at the API layer, but business-initiated conversations require an approved template until the user replies (24-hour session).";
  } else if (
    !deliveryStatus &&
    !input.inboundHeartbeat?.last_webhook_received_at
  ) {
    primaryCause = "missing_status_webhooks";
    confidence = "high";
    summary =
      "No message_status webhooks observed. Meta may have failed delivery asynchronously, but the app cannot see why until webhooks are configured and subscribed.";
  }

  return {
    primaryCause,
    confidence,
    summary,
    checks,
    nextSteps: [...new Set(nextSteps)],
  };
}

export async function buildMetaMessageStatusReport(options?: {
  messageId?: string | null;
  templateName?: string | null;
}) {
  if (!isMetaWhatsAppConfigured()) {
    throw new Error("Meta WhatsApp is not configured.");
  }

  const [phoneNumber, waba, templates, inboundHeartbeat, outboundHeartbeat] =
    await Promise.all([
      fetchMetaPhoneNumberProfile(),
      fetchMetaWabaProfile(),
      fetchMetaMessageTemplates(options?.templateName),
      getInboundHeartbeat(),
      getOutboundHeartbeat(),
    ]);

  const runtimeOutbound = getOutboundHealthSnapshot();
  const diagnosis = buildMetaDeliveryDiagnosis({
    phoneNumber,
    waba,
    templates,
    inboundHeartbeat,
    outboundHeartbeat,
    runtimeOutbound,
    messageId: options?.messageId ?? null,
    appSendType: "text",
  });

  return {
    debugLabel: "meta-message-status-v1",
    timestamp: new Date().toISOString(),
    configured: {
      provider: process.env.WHATSAPP_PROVIDER ?? "auto",
      graphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v21.0",
      phoneNumberIdConfigured: Boolean(process.env.META_WHATSAPP_PHONE_NUMBER_ID),
      wabaIdConfigured: Boolean(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID),
      appSecretConfigured: Boolean(process.env.META_WHATSAPP_APP_SECRET),
    },
    message: {
      requestedId: options?.messageId ?? null,
      trackedId:
        options?.messageId ??
        outboundHeartbeat?.last_evolution_message_id ??
        runtimeOutbound.lastSuccess?.evolutionMessageId ??
        null,
      appOutboundType: "text",
      graphApiMeaning:
        "HTTP 200 + wamid + message_status=accepted means queued by Meta, not delivered to the handset.",
      metaErrorHints: META_ERROR_HINTS,
    },
    phoneNumber: phoneNumber?.ok ? phoneNumber.data : { error: phoneNumber?.error },
    waba: waba?.ok ? waba.data : waba ? { error: waba.error } : null,
    templates: templates?.ok
      ? templates.data.data ?? []
      : templates
        ? { error: templates.error }
        : null,
    webhooks: {
      inbound: inboundHeartbeat,
      outbound: outboundHeartbeat,
      lastDeliveryStatus: outboundHeartbeat?.last_delivery_status ?? null,
      lastDeliveryError: outboundHeartbeat?.last_error ?? null,
      note: "Meta does not expose per-wamid delivery polling; status comes from message_status webhooks.",
    },
    runtimeOutbound: {
      lastSuccess: runtimeOutbound.lastSuccess,
      lastFailure: runtimeOutbound.lastFailure,
    },
    diagnosis,
  };
}

export { isMetaWhatsAppConfigured };
