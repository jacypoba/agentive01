import { createHash, randomBytes } from "crypto";

const TOKEN_BYTE_LENGTH = 32;

/** Generates a URL-safe invitation token and its SHA-256 hash for storage. */
export function generateInvitationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
