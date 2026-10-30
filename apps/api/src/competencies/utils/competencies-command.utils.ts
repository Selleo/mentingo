import { match } from "ts-pattern";

import { COMPETENCIES_COMMAND_OPERATIONS } from "../competencies.constants";

import type { CompetenciesCommand } from "@mentingo/competencies-sdk";

/** People a command refers to; each must be an active user of this tenant. */
export const getCommandSubjectIds = (command: CompetenciesCommand) =>
  match(command)
    .with({ operation: COMPETENCIES_COMMAND_OPERATIONS.SAVE_COMPETENCY }, ({ value }) =>
      value.levels.flatMap((level) =>
        level.conditions.flatMap((condition) => condition.verifierIds ?? []),
      ),
    )
    .with({ operation: COMPETENCIES_COMMAND_OPERATIONS.SUBMIT_EVIDENCE }, ({ value }) => [
      value.subjectId,
    ])
    .with(
      { operation: COMPETENCIES_COMMAND_OPERATIONS.ASSIGN_PROFILE },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.REVIEW_EVIDENCE },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.REVOKE_CONFIRMATION },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.SET_CONDITION_OVERRIDE },
      ({ subjectId }) => [subjectId],
    )
    .with(
      { operation: COMPETENCIES_COMMAND_OPERATIONS.SAVE_CATEGORY },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.DELETE_CATEGORY },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.DELETE_COMPETENCY },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.SAVE_PROFILE },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.DELETE_PROFILE },
      { operation: COMPETENCIES_COMMAND_OPERATIONS.SETTINGS },
      () => [],
    )
    .exhaustive();
