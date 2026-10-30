import { match } from "ts-pattern";

import type {
  CompetencyCondition,
  CompetencyInput,
  CompetencyOptions,
} from "../competencies.types";

export const NO_OPTIONS: CompetencyOptions = { courses: [], people: [] };

export const COMPETENCY_CONDITION_KINDS = {
  COURSE: "course",
  DOCUMENT: "document",
  OBSERVATION: "observation",
} as const;

export const CONDITION_KINDS = Object.values(COMPETENCY_CONDITION_KINDS);

export function createCompetencyDraft(value?: CompetencyInput): CompetencyInput {
  if (!value) return { name: "", description: "", categoryId: null, levels: [] };
  return {
    name: value.name,
    description: value.description,
    categoryId: value.categoryId,
    levels: value.levels.map((level) => ({
      ...level,
      conditions: level.conditions.map((condition) => ({
        ...condition,
        verifierIds: match(condition.kind)
          .with(COMPETENCY_CONDITION_KINDS.COURSE, () => [])
          .with(
            COMPETENCY_CONDITION_KINDS.OBSERVATION,
            COMPETENCY_CONDITION_KINDS.DOCUMENT,
            () => condition.verifierIds ?? [],
          )
          .exhaustive(),
      })),
    })),
  };
}

export function updateCompetencyCondition(
  draft: CompetencyInput,
  levelId: string,
  conditionId: string,
  update: Partial<CompetencyCondition>,
): CompetencyInput {
  return {
    ...draft,
    levels: draft.levels.map((level) => {
      if (level.id !== levelId) return level;
      return {
        ...level,
        conditions: level.conditions.map((condition) =>
          match(condition.id)
            .with(conditionId, () => ({ ...condition, ...update }))
            .otherwise(() => condition),
        ),
      };
    }),
  };
}
