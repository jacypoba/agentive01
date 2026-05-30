import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  extractCronSecretFromRequest,
  hasWorkspaceAdminRole,
  isCronSecretAuthorized,
  isCronSecretConfigured,
} from "@/lib/security/operational-endpoint-auth";
import {
  redactConnectionSnapshot,
  redactEndpointUrl,
  redactEvolutionEnvBlock,
  redactMetaProviderBlock,
} from "@/lib/security/redact-debug-response";

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL_CRON_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  }
});

describe("isCronSecretAuthorized", () => {
  it("accepts Authorization Bearer when CRON_SECRET matches", () => {
    process.env.CRON_SECRET = "test-secret-123";
    const request = new Request("https://app.example/api/debug/test", {
      headers: { authorization: "Bearer test-secret-123" },
    });
    assert.equal(isCronSecretAuthorized(request), true);
  });

  it("accepts x-cron-secret header when CRON_SECRET matches", () => {
    process.env.CRON_SECRET = "test-secret-123";
    const request = new Request("https://app.example/api/debug/test", {
      headers: { "x-cron-secret": "test-secret-123" },
    });
    assert.equal(isCronSecretAuthorized(request), true);
  });

  it("rejects invalid cron secret", () => {
    process.env.CRON_SECRET = "test-secret-123";
    const request = new Request("https://app.example/api/debug/test", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    assert.equal(isCronSecretAuthorized(request), false);
  });

  it("rejects when CRON_SECRET env is not configured", () => {
    delete process.env.CRON_SECRET;
    const request = new Request("https://app.example/api/debug/test", {
      headers: { authorization: "Bearer anything" },
    });
    assert.equal(isCronSecretConfigured(), false);
    assert.equal(isCronSecretAuthorized(request), false);
  });

  it("rejects missing credentials", () => {
    process.env.CRON_SECRET = "test-secret-123";
    const request = new Request("https://app.example/api/debug/test");
    assert.equal(extractCronSecretFromRequest(request), null);
    assert.equal(isCronSecretAuthorized(request), false);
  });
});

describe("hasWorkspaceAdminRole", () => {
  it("allows owner and admin roles", () => {
    assert.equal(hasWorkspaceAdminRole([{ role: "owner" }]), true);
    assert.equal(hasWorkspaceAdminRole([{ role: "admin" }]), true);
  });

  it("denies member-only access", () => {
    assert.equal(hasWorkspaceAdminRole([{ role: "member" }]), false);
    assert.equal(hasWorkspaceAdminRole([]), false);
  });
});

describe("redact debug responses", () => {
  it("redacts endpoint URLs", () => {
    assert.equal(
      redactEndpointUrl("https://evolution.example.com/message/sendText/instance-1"),
      "[redacted-host]/message/sendText/[redacted]"
    );
  });

  it("redacts evolution env block without exposing instance or base URL", () => {
    const redacted = redactEvolutionEnvBlock({
      baseUrl: "https://evolution.example.com",
      instanceName: "agency-main",
      hasApiKey: true,
      endpoint: "https://evolution.example.com/message/sendText/agency-main",
    });

    assert.equal(redacted.hasApiKey, true);
    assert.equal(redacted.hasInstanceName, true);
    assert.equal(redacted.configured, true);
    assert.match(redacted.endpoint ?? "", /^\[redacted-host\]/);
    assert.doesNotMatch(JSON.stringify(redacted), /agency-main/);
    assert.doesNotMatch(JSON.stringify(redacted), /evolution\.example\.com/);
  });

  it("redacts meta phone number id", () => {
    const redacted = redactMetaProviderBlock({
      configured: true,
      phoneNumberId: "123456789012345",
      graphApiVersion: "v21.0",
    });

    assert.equal(redacted.phoneNumberIdConfigured, true);
    assert.doesNotMatch(JSON.stringify(redacted), /123456789012345/);
  });

  it("redacts connection snapshot endpoint", () => {
    const redacted = redactConnectionSnapshot({
      ok: true,
      status: 200,
      endpoint: "https://evolution.example.com/instance/connectionState/foo",
      state: "open",
    });

    assert.match(redacted?.endpoint ?? "", /^\[redacted-host\]/);
  });
});
