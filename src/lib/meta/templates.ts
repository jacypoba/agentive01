/** Approved Meta WhatsApp message templates (business-initiated / outside 24h window). */

export type MetaTemplateParameter =
  | { type: "text"; text: string }
  | {
      type: "currency";
      currency: { fallback_value: string; code: string; amount_1000: number };
    }
  | { type: "date_time"; date_time: { fallback_value: string } }
  | { type: "image"; image: { link: string } };

export type MetaTemplateComponent = {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: number;
  parameters: MetaTemplateParameter[];
};

export type MetaTemplateDefinition = {
  name: string;
  languageCode: string;
  /** Sample body text params for debug sends when the template has variables. */
  defaultBodyParameters?: string[];
};

export type MetaTemplateSendOptions = {
  name: string;
  languageCode?: string;
  components?: MetaTemplateComponent[];
  /** Shorthand: body component text parameters in order. */
  bodyParameters?: string[];
};

export const APPROVED_META_TEMPLATES: Record<string, MetaTemplateDefinition> = {
  hello_world: {
    name: "hello_world",
    languageCode: "en_US",
  },
  jaspers_market_order_confirmation_v1: {
    name: "jaspers_market_order_confirmation_v1",
    languageCode: "en_US",
    defaultBodyParameters: ["Jasper", "ORDER-12345", "May 23, 2026", "$24.99"],
  },
};

export function isApprovedMetaTemplateName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(APPROVED_META_TEMPLATES, name.trim());
}

export function listApprovedMetaTemplateNames(): string[] {
  return Object.keys(APPROVED_META_TEMPLATES);
}

function resolveTemplateDefinition(name: string): MetaTemplateDefinition {
  const trimmed = name.trim();
  const definition = APPROVED_META_TEMPLATES[trimmed];
  if (!definition) {
    throw new Error(
      `Unknown or unapproved Meta template "${trimmed}". Approved: ${listApprovedMetaTemplateNames().join(", ")}.`
    );
  }
  return definition;
}

export function buildBodyComponent(parameters: string[]): MetaTemplateComponent | null {
  const texts = parameters.map((value) => value.trim()).filter(Boolean);
  if (texts.length === 0) {
    return null;
  }

  return {
    type: "body",
    parameters: texts.map((text) => ({ type: "text", text })),
  };
}

export function resolveMetaTemplateComponents(
  options: MetaTemplateSendOptions
): MetaTemplateComponent[] | undefined {
  if (options.components?.length) {
    return options.components;
  }

  const definition = resolveTemplateDefinition(options.name);
  const bodyParams =
    options.bodyParameters ??
    (definition.defaultBodyParameters?.length ? definition.defaultBodyParameters : undefined);

  if (!bodyParams?.length) {
    return undefined;
  }

  const body = buildBodyComponent(bodyParams);
  return body ? [body] : undefined;
}

export function buildMetaTemplateMessagePayload(
  destinationNumber: string,
  options: MetaTemplateSendOptions
): Record<string, unknown> {
  const definition = resolveTemplateDefinition(options.name);
  const languageCode = options.languageCode?.trim() || definition.languageCode;
  const components = resolveMetaTemplateComponents(options);

  const template: Record<string, unknown> = {
    name: definition.name,
    language: { code: languageCode },
  };

  if (components?.length) {
    template.components = components;
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: destinationNumber,
    type: "template",
    template,
  };
}

export function parseMetaGraphMessagesResponse(responseBody: string | undefined): {
  messages?: Array<{ id?: string; message_status?: string }>;
  error?: { message?: string; code?: number; error_subcode?: number };
} {
  if (!responseBody?.trim()) {
    return {};
  }

  try {
    return JSON.parse(responseBody) as {
      messages?: Array<{ id?: string; message_status?: string }>;
      error?: { message?: string; code?: number; error_subcode?: number };
    };
  } catch {
    return {};
  }
}
