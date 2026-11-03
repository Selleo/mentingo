import type { CompetenciesCommand } from "./competencies.types";

export const COMPETENCIES_COMMAND_OPERATIONS = {
  SAVE_CATEGORY: "save_category",
  DELETE_CATEGORY: "delete_category",
  SAVE_COMPETENCY: "save_competency",
  DELETE_COMPETENCY: "delete_competency",
  SAVE_PROFILE: "save_profile",
  DELETE_PROFILE: "delete_profile",
  ASSIGN_PROFILE: "assign_profile",
  SUBMIT_EVIDENCE: "submit_evidence",
  REVIEW_EVIDENCE: "review_evidence",
  REVOKE_CONFIRMATION: "revoke_confirmation",
  SET_CONDITION_OVERRIDE: "set_condition_override",
  SETTINGS: "settings",
} as const satisfies Record<string, CompetenciesCommand["operation"]>;

export const COMPETENCIES_EVIDENCE_KINDS = {
  DOCUMENT: "document",
  OBSERVATION: "observation",
  RECOGNITION: "recognition",
} as const;

export const COMPETENCIES_REVIEW_DECISIONS = {
  APPROVED: "approved",
  REJECTED: "rejected",
  REVOKED: "revoked",
} as const;
