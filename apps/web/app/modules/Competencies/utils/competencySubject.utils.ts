import { match } from "ts-pattern";

import { canVerifyConditions } from "./competenciesVerifiers.utils";
import { COMPETENCY_CONDITION_KINDS } from "./competencyEditor.utils";

import type {
  CompetencyCondition,
  CompetencyLevel,
  CompetencyStanding,
  Competency,
  CompetencySubjectWorkspace,
} from "../competencies.types";

export const REQUIREMENT_FILTER_VALUES = {
  ALL: "all",
  MISSING: "missing",
  EXPIRING: "expiring",
  MET: "met",
} as const;

export type RequirementFilter =
  (typeof REQUIREMENT_FILTER_VALUES)[keyof typeof REQUIREMENT_FILTER_VALUES];

export type RequirementState = Exclude<RequirementFilter, "all">;

export const REQUIREMENT_FILTERS = Object.values(REQUIREMENT_FILTER_VALUES);

export const REQUIREMENT_ORDER: RequirementState[] = [
  REQUIREMENT_FILTER_VALUES.MISSING,
  REQUIREMENT_FILTER_VALUES.EXPIRING,
  REQUIREMENT_FILTER_VALUES.MET,
];

export function getRequirementState(row: {
  confirmed: boolean;
  standing: { expiring?: boolean };
}): RequirementState {
  if (row.standing.expiring) return REQUIREMENT_FILTER_VALUES.EXPIRING;
  if (row.confirmed) return REQUIREMENT_FILTER_VALUES.MET;
  return REQUIREMENT_FILTER_VALUES.MISSING;
}

export function matchesRequirementFilter(
  row: { confirmed: boolean; standing: { expiring?: boolean } },
  filter: RequirementFilter,
) {
  return filter === REQUIREMENT_FILTER_VALUES.ALL || getRequirementState(row) === filter;
}

export function getSubjectRequirements(
  workspace: CompetencySubjectWorkspace,
  userId: string,
  canManage: boolean,
) {
  const assessment = workspace.assessment;
  const standings = workspace.standings;
  const definitions = workspace.competencies.filter(
    (definition) =>
      definition.levels.length && standings.some((item) => item.competencyId === definition.id),
  );
  const activeDefinitions = definitions.filter((definition) => !definition.archived);
  const canInspectCompetencies =
    canManage ||
    workspace.canPlan ||
    activeDefinitions.some((definition) =>
      definition.levels.some((level) =>
        level.conditions.some((condition) =>
          canVerifyConditions(workspace.competencies, definition.id, [condition.id], userId),
        ),
      ),
    );
  const rows = definitions.map((definition) => {
    const requirement = assessment?.requirements.find(
      (item) => item.requirement.competencyId === definition.id,
    );
    const standing = standings.find((item) => item.competencyId === definition.id)!;
    const currentIndex = definition.levels.findIndex(
      (level) => level.id === standing.currentLevelId,
    );
    const requiredIndex = definition.levels.findIndex(
      (level) => level.id === requirement?.requirement.levelId,
    );
    return {
      definition,
      standing,
      currentIndex,
      requiredIndex,
      confirmed: (requirement ? requirement.met : currentIndex >= 0) && !standing.expiring,
    };
  });
  const hasNoProfile = !assessment?.profileId;
  const requirementRows = rows
    .filter((row) => row.requiredIndex >= 0)
    .sort(
      (left, right) =>
        REQUIREMENT_ORDER.indexOf(getRequirementState(left)) -
        REQUIREMENT_ORDER.indexOf(getRequirementState(right)),
    );

  return { activeDefinitions, canInspectCompetencies, hasNoProfile, requirementRows };
}

export function getCompetencySubjectDetails(
  workspace: CompetencySubjectWorkspace,
  definition: Competency,
  userId: string,
  subjectId: string,
) {
  const standings = workspace.standings;
  const records = workspace.evidence;
  const standing = standings.find((item) => item.competencyId === definition.id)!;
  const current = definition.levels.find((level) => level.id === standing.currentLevelId);
  const currentIndex = definition.levels.findIndex((level) => level.id === current?.id);
  const nextLevel = definition.levels[currentIndex + 1];
  const requirement = workspace.assessment?.requirements.find(
    (item) => item.requirement.competencyId === definition.id,
  );
  const requiredLevel = definition.levels.find(
    (level) => level.id === requirement?.requirement.levelId,
  );
  const attained = definition.levels.find((level) => level.id === standing.attainedLevelId);
  const attainedLevelName = attained?.name ?? standing.attainedLevelName;
  const verifiableLevels = definition.levels
    .map((level) => ({
      ...level,
      conditions: level.conditions.filter((condition) =>
        canVerifyConditions(workspace.competencies, definition.id, [condition.id], userId),
      ),
    }))
    .filter((level) => level.conditions.length > 0);
  const verifier = subjectId !== userId && verifiableLevels.length > 0;
  const revocableConditions = definition.levels
    .slice(0, definition.levels.findIndex((level) => level.id === current?.id) + 1)
    .flatMap((level) => level.conditions)
    .filter((condition) =>
      canVerifyConditions(workspace.competencies, definition.id, [condition.id], userId),
    );
  const evidence = records.filter((item) => item.competencyId === definition.id);

  return {
    standing,
    current,
    nextLevel,
    requiredLevel,
    attainedLevelName,
    verifiableLevels,
    verifier,
    revocableConditions,
    evidence,
  };
}

export function getSubjectMessageKeys(assessment: CompetencySubjectWorkspace["assessment"]) {
  if (!assessment || assessment.coverage === null)
    return { summaryKey: "competencies.noProfile", statusKey: "competencies.noProfile" } as const;
  if (assessment.metCount === assessment.requirementCount)
    return {
      summaryKey: "competencies.allRequirementsMet",
      statusKey: "competencies.employee.statusMet",
    } as const;
  return {
    summaryKey: "competencies.needsAttention",
    statusKey: "competencies.employee.statusGaps",
  } as const;
}

export function getCompetencyLevelProgress(
  definition: Competency,
  standing: CompetencyStanding,
  level: CompetencyLevel,
) {
  const results = standing.levels.find((item) => item.levelId === level.id)?.conditions ?? [];
  const confirmedRequirements = level.conditions.filter((condition) =>
    results.some((result) => result.conditionId === condition.id && result.met),
  ).length;
  const currentIndex = definition.levels.findIndex((item) => item.id === standing.currentLevelId);
  const levelIndex = definition.levels.findIndex((item) => item.id === level.id);
  return {
    confirmed: levelIndex >= 0 && currentIndex >= levelIndex,
    confirmedRequirements,
    results,
  };
}

export function getConditionGuidanceKey(condition: CompetencyCondition) {
  if (condition.kind !== COMPETENCY_CONDITION_KINDS.COURSE && !condition.verifierIds?.length)
    return "competencies.detailGuide.noVerifier" as const;
  return match(condition.kind)
    .with(COMPETENCY_CONDITION_KINDS.COURSE, () => "competencies.detailGuide.courseHelp" as const)
    .with(
      COMPETENCY_CONDITION_KINDS.DOCUMENT,
      () => "competencies.detailGuide.documentHelp" as const,
    )
    .with(
      COMPETENCY_CONDITION_KINDS.OBSERVATION,
      () => "competencies.detailGuide.observationHelp" as const,
    )
    .exhaustive();
}
