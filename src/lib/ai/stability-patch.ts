/**
 * Stability Patch v1 — sticky language, greeting, no-match UX.
 * When disabled, language resolution uses legacy baseline behavior.
 */
export function isStabilityPatchV1Enabled(): boolean {
  const raw = process.env.STABILITY_PATCH_V1?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
