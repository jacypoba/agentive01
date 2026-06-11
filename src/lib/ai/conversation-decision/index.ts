export type {
  BuildConversationDecisionShadowInput,
  ConversationAction,
  ConversationDecision,
  ConversationDecisionShadowDiff,
  ConversationDecisionShadowLog,
  CriteriaField,
  DecisionConfidence,
  DecisionContextUse,
  DecisionSearchCriteria,
  InventorySummary,
  ReplyInstruction,
} from "./types";

export {
  buildConversationDecisionShadow,
  isConversationDecisionShadowEnabled,
} from "./build-shadow";

export {
  decisionCriteriaToSearchCriteria,
  filterPropertiesForDecisionCity,
  isConversationDecisionEnginePhaseBEnabled,
  logConversationDecisionPhaseBApplied,
  shouldApplyPhaseBCityOverride,
  tryApplyPhaseBCityOverride,
  type PhaseBPropertyResolution,
} from "./apply-phase-b";

export {
  hasPropertyPivotEvidence,
  isConversationDecisionEnginePhaseB2Enabled,
  logConversationDecisionPhaseB2Applied,
  shouldApplyPhaseB2PropertyPivot,
  tryApplyPhaseB2PropertyPivot,
  type PhaseB2PropertyResolution,
} from "./apply-phase-b2";

export {
  buildCurrentFlowCriteria,
  buildShadowDiff,
  logConversationDecisionShadow,
  mapIntentToExpectedAction,
  previewMessage,
} from "./log-shadow";

export {
  extractBroadPropertyType,
  resolveCriteriaShadow,
} from "./resolve-criteria-shadow";

export { selectActionShadow, selectActionShadowForPivot } from "./select-action-shadow";

export { runConversationDecisionShadowTurn } from "./run-shadow";
