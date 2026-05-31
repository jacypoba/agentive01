import type { InvitableRole } from "@/lib/team/roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateInvitationEmail(email: string): string | null {
  const normalized = normalizeInvitationEmail(email);

  if (!normalized) {
    return "Email is required.";
  }

  if (normalized.length > 320) {
    return "Email is too long.";
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function parseInvitableRole(value: string): InvitableRole | null {
  if (value === "admin" || value === "member") {
    return value;
  }
  return null;
}

export function emailsMatch(a: string, b: string): boolean {
  return normalizeInvitationEmail(a) === normalizeInvitationEmail(b);
}
