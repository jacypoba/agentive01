import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLoginRedirectUrl,
  sanitizeInviteRedirectPath,
  sanitizeRedirectPath,
} from "@/lib/auth/redirect";

describe("sanitizeInviteRedirectPath", () => {
  it("accepts invite paths with encoded token segments", () => {
    assert.equal(
      sanitizeInviteRedirectPath("/invite/abc123token"),
      "/invite/abc123token"
    );
    assert.equal(
      sanitizeInviteRedirectPath("/invite/ZGF0YQ"),
      "/invite/ZGF0YQ"
    );
  });

  it("rejects non-invite redirects", () => {
    assert.equal(sanitizeInviteRedirectPath("/dashboard"), null);
    assert.equal(sanitizeInviteRedirectPath("/settings/team"), null);
    assert.equal(sanitizeInviteRedirectPath("/login"), null);
  });

  it("rejects open redirects", () => {
    assert.equal(sanitizeInviteRedirectPath("//evil.example/invite/token"), null);
    assert.equal(sanitizeInviteRedirectPath("https://evil.example"), null);
  });

  it("rejects malformed invite paths", () => {
    assert.equal(sanitizeInviteRedirectPath("/invite"), null);
    assert.equal(sanitizeInviteRedirectPath("/invite/"), null);
    assert.equal(sanitizeInviteRedirectPath("/invite/a/extra"), null);
  });
});

describe("switch account invite flow", () => {
  it("builds login URL that returns to the invite page after auth", () => {
    const invitePath = "/invite/signed-token-value";
    const loginUrl = buildLoginRedirectUrl(invitePath);

    assert.equal(loginUrl, "/login?redirect=%2Finvite%2Fsigned-token-value");

    const redirectParam = new URL(loginUrl, "https://app.example").searchParams.get(
      "redirect"
    );
    assert.equal(sanitizeInviteRedirectPath(redirectParam), invitePath);
    assert.equal(sanitizeRedirectPath(redirectParam), invitePath);
  });

  it("does not put the invite token in query params beyond the redirect path", () => {
    const invitePath = "/invite/my-token";
    const loginUrl = buildLoginRedirectUrl(invitePath);
    const url = new URL(loginUrl, "https://app.example");

    assert.equal(url.pathname, "/login");
    assert.equal(url.searchParams.has("token"), false);
    assert.equal(url.searchParams.get("redirect"), invitePath);
  });

  it("models mismatched signed-in user switching account before accept", () => {
    const signedInEmail = "owner@agency.com";
    const invitedEmail = "teammate@agency.com";
    const invitePath = "/invite/secure-token";

    assert.notEqual(signedInEmail, invitedEmail);

    const safeRedirect = sanitizeInviteRedirectPath(invitePath);
    assert.ok(safeRedirect);

    const postLogoutLogin = buildLoginRedirectUrl(safeRedirect);
    assert.match(postLogoutLogin, /^\/login\?redirect=/);

    const restoredInvitePath = sanitizeInviteRedirectPath(
      new URL(postLogoutLogin, "https://app.example").searchParams.get("redirect")
    );
    assert.equal(restoredInvitePath, invitePath);
  });
});
