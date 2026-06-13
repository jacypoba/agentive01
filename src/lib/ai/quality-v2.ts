/**
 * Phase 1 conversation quality improvements.
 * When disabled, legacy prompts, intros, and directives are preserved (baseline).
 */
export function isAiQualityV2Enabled(): boolean {
  const raw = process.env.AI_QUALITY_V2?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
