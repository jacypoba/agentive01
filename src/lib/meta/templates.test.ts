import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPROVED_META_TEMPLATES,
  buildMetaTemplateMessagePayload,
  isApprovedMetaTemplateName,
  listApprovedMetaTemplateNames,
  parseMetaGraphMessagesResponse,
  resolveMetaTemplateComponents,
} from "@/lib/meta/templates";

describe("Meta template messaging", () => {
  it("lists approved templates including hello_world", () => {
    const names = listApprovedMetaTemplateNames();
    assert.ok(names.includes("hello_world"));
    assert.ok(names.includes("jaspers_market_order_confirmation_v1"));
    assert.equal(isApprovedMetaTemplateName("hello_world"), true);
    assert.equal(isApprovedMetaTemplateName("unknown_template"), false);
  });

  it("builds hello_world payload with type=template and no components", () => {
    const payload = buildMetaTemplateMessagePayload("15551234567", {
      name: "hello_world",
    });

    assert.equal(payload.messaging_product, "whatsapp");
    assert.equal(payload.to, "15551234567");
    assert.equal(payload.type, "template");

    const template = payload.template as {
      name: string;
      language: { code: string };
      components?: unknown;
    };
    assert.equal(template.name, "hello_world");
    assert.equal(template.language.code, "en_US");
    assert.equal(template.components, undefined);
  });

  it("builds jaspers template with default body parameters", () => {
    const payload = buildMetaTemplateMessagePayload("393471234567", {
      name: "jaspers_market_order_confirmation_v1",
    });

    const template = payload.template as {
      name: string;
      components: Array<{ type: string; parameters: Array<{ text: string }> }>;
    };
    assert.equal(template.name, "jaspers_market_order_confirmation_v1");
    assert.equal(template.components.length, 1);
    assert.equal(template.components[0].type, "body");
    assert.equal(template.components[0].parameters.length, 4);
  });

  it("allows explicit body parameters override", () => {
    const components = resolveMetaTemplateComponents({
      name: "hello_world",
      bodyParameters: ["Only", "Used", "When", "Provided"],
    });

    assert.ok(components);
    assert.equal(components?.[0].parameters.length, 4);
  });

  it("rejects unapproved template names", () => {
    assert.throws(
      () =>
        buildMetaTemplateMessagePayload("15551234567", {
          name: "not_a_real_template",
        }),
      /unapproved Meta template/i
    );
  });

  it("parses Graph API message responses", () => {
    const parsed = parseMetaGraphMessagesResponse(
      JSON.stringify({
        messaging_product: "whatsapp",
        contacts: [{ input: "15551234567", wa_id: "15551234567" }],
        messages: [{ id: "wamid.test", message_status: "accepted" }],
      })
    );

    assert.equal(parsed.messages?.[0]?.id, "wamid.test");
    assert.equal(parsed.messages?.[0]?.message_status, "accepted");
  });

  it("exposes registry language codes", () => {
    assert.equal(APPROVED_META_TEMPLATES.hello_world.languageCode, "en_US");
    assert.equal(
      APPROVED_META_TEMPLATES.jaspers_market_order_confirmation_v1.languageCode,
      "en_US"
    );
  });
});
