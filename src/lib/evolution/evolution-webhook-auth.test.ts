import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { verifyEvolutionWebhook } from "@/lib/evolution/evolution-webhook-auth";

describe("verifyEvolutionWebhook", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.EVOLUTION_API_KEY = "global-api-key";
    process.env.EVOLUTION_WEBHOOK_SECRET = "webhook-secret";
    process.env.EVOLUTION_INSTANCE_TOKEN = "instance-token";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepts matching query secret", () => {
    const request = new Request(
      "https://agentive01-new.vercel.app/api/webhooks/evolution?secret=webhook-secret",
      { method: "POST" }
    );

    assert.equal(
      verifyEvolutionWebhook(request, { event: "messages.upsert", apikey: "other" }),
      true
    );
  });

  it("accepts apikey header with trimmed global key", () => {
    const request = new Request("https://agentive01-new.vercel.app/api/webhooks/evolution", {
      method: "POST",
      headers: { apikey: "global-api-key" },
    });

    assert.equal(verifyEvolutionWebhook(request, { event: "messages.upsert" }), true);
  });

  it("accepts payload apikey instance token", () => {
    const request = new Request("https://agentive01-new.vercel.app/api/webhooks/evolution", {
      method: "POST",
    });

    assert.equal(
      verifyEvolutionWebhook(request, {
        event: "messages.upsert",
        apikey: "instance-token",
      }),
      true
    );
  });

  it("accepts Authorization bearer webhook secret", () => {
    const request = new Request("https://agentive01-new.vercel.app/api/webhooks/evolution", {
      method: "POST",
      headers: { Authorization: "Bearer webhook-secret" },
    });

    assert.equal(verifyEvolutionWebhook(request, { event: "messages.upsert" }), true);
  });

  it("rejects when no auth matches in production", () => {
    const request = new Request("https://agentive01-new.vercel.app/api/webhooks/evolution", {
      method: "POST",
    });

    assert.equal(
      verifyEvolutionWebhook(request, {
        event: "messages.upsert",
        apikey: "wrong-token",
      }),
      false
    );
  });
});
