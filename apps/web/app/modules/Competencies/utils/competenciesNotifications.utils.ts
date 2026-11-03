import { match, P } from "ts-pattern";

import {
  COMPETENCIES_COMMAND_OPERATIONS as OPERATIONS,
  COMPETENCIES_EVIDENCE_KINDS as EVIDENCE,
  COMPETENCIES_REVIEW_DECISIONS as DECISIONS,
} from "../competenciesCommand.constants";
import { COMPETENCY_OVERRIDE_STATUSES } from "../competencyOverrides.constants";

import type { CompetenciesCommand } from "../competencies.types";

export function getCompetenciesSuccessMessageKey(command: CompetenciesCommand) {
  return match(command)
    .with(
      { operation: OPERATIONS.SAVE_CATEGORY, id: P.string },
      () => "competencies.notifications.categoryUpdated",
    )
    .with(
      { operation: OPERATIONS.SAVE_CATEGORY },
      () => "competencies.notifications.categoryCreated",
    )
    .with(
      { operation: OPERATIONS.DELETE_CATEGORY },
      () => "competencies.notifications.categoryDeleted",
    )
    .with(
      { operation: OPERATIONS.SAVE_COMPETENCY, id: P.string },
      () => "competencies.notifications.competencyUpdated",
    )
    .with(
      { operation: OPERATIONS.SAVE_COMPETENCY },
      () => "competencies.notifications.competencyCreated",
    )
    .with(
      { operation: OPERATIONS.DELETE_COMPETENCY },
      () => "competencies.notifications.competencyDeleted",
    )
    .with(
      { operation: OPERATIONS.SAVE_PROFILE, id: P.string },
      () => "competencies.notifications.profileUpdated",
    )
    .with({ operation: OPERATIONS.SAVE_PROFILE }, () => "competencies.notifications.profileCreated")
    .with(
      { operation: OPERATIONS.DELETE_PROFILE },
      () => "competencies.notifications.profileDeleted",
    )
    .with(
      { operation: OPERATIONS.ASSIGN_PROFILE, profileId: null },
      () => "competencies.notifications.profileRemoved",
    )
    .with(
      { operation: OPERATIONS.ASSIGN_PROFILE },
      () => "competencies.notifications.profileAssigned",
    )
    .with(
      { operation: OPERATIONS.SUBMIT_EVIDENCE, value: { kind: EVIDENCE.DOCUMENT } },
      () => "competencies.notifications.documentSubmitted",
    )
    .with(
      { operation: OPERATIONS.SUBMIT_EVIDENCE, value: { kind: EVIDENCE.OBSERVATION } },
      () => "competencies.notifications.observationConfirmed",
    )
    .with(
      { operation: OPERATIONS.SUBMIT_EVIDENCE, value: { kind: EVIDENCE.RECOGNITION } },
      () => "competencies.notifications.qualificationsRecognized",
    )
    .with(
      { operation: OPERATIONS.REVIEW_EVIDENCE, decision: DECISIONS.APPROVED },
      () => "competencies.notifications.submissionApproved",
    )
    .with(
      { operation: OPERATIONS.REVIEW_EVIDENCE, decision: DECISIONS.REJECTED },
      () => "competencies.notifications.submissionRejected",
    )
    .with(
      { operation: OPERATIONS.REVIEW_EVIDENCE, decision: DECISIONS.REVOKED },
      { operation: OPERATIONS.REVOKE_CONFIRMATION },
      () => "competencies.notifications.confirmationRevoked",
    )
    .with(
      { operation: OPERATIONS.SET_CONDITION_OVERRIDE, status: COMPETENCY_OVERRIDE_STATUSES.MET },
      () => "competencies.notifications.manuallyConfirmed",
    )
    .with(
      {
        operation: OPERATIONS.SET_CONDITION_OVERRIDE,
        status: COMPETENCY_OVERRIDE_STATUSES.AUTOMATIC,
      },
      () => "competencies.notifications.evidenceEvaluationRestored",
    )
    .with(
      { operation: OPERATIONS.SETTINGS, warningDays: null },
      () => "competencies.notifications.expiryDisabled",
    )
    .with({ operation: OPERATIONS.SETTINGS }, () => "competencies.notifications.expiryUpdated")
    .exhaustive();
}

export function getCompetenciesFailureMessageKey(command: CompetenciesCommand) {
  return match(command.operation)
    .with(OPERATIONS.SAVE_CATEGORY, () => "competencies.notifications.categorySaveFailed")
    .with(OPERATIONS.DELETE_CATEGORY, () => "competencies.notifications.categoryDeleteFailed")
    .with(OPERATIONS.SAVE_COMPETENCY, () => "competencies.notifications.competencySaveFailed")
    .with(OPERATIONS.DELETE_COMPETENCY, () => "competencies.notifications.competencyDeleteFailed")
    .with(OPERATIONS.SAVE_PROFILE, () => "competencies.notifications.profileSaveFailed")
    .with(OPERATIONS.DELETE_PROFILE, () => "competencies.notifications.profileDeleteFailed")
    .with(OPERATIONS.ASSIGN_PROFILE, () => "competencies.notifications.profileAssignmentFailed")
    .with(OPERATIONS.SUBMIT_EVIDENCE, () => "competencies.notifications.evidenceSubmitFailed")
    .with(OPERATIONS.REVIEW_EVIDENCE, () => "competencies.notifications.reviewFailed")
    .with(OPERATIONS.REVOKE_CONFIRMATION, () => "competencies.notifications.revocationFailed")
    .with(OPERATIONS.SET_CONDITION_OVERRIDE, () => "competencies.notifications.adjustmentFailed")
    .with(OPERATIONS.SETTINGS, () => "competencies.notifications.settingsFailed")
    .exhaustive();
}
