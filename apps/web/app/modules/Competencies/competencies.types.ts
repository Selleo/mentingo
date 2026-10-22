import type { ApiClient } from "~/api/api-client";

export type CompetenciesWorkspace = Awaited<
  ReturnType<typeof ApiClient.api.competenciesControllerGetCompetenciesWorkspace>
>["data"]["data"];
export type Competency = CompetenciesWorkspace["catalog"][number];
export type CompetencyLevel = Competency["levels"][number];
export type CompetencyCondition = CompetencyLevel["conditions"][number];
export type CompetencyStanding = CompetenciesWorkspace["standings"][number]["standing"];
export type CompetencyConditionAssessment =
  CompetencyStanding["levels"][number]["conditions"][number];
export type CompetencyEvidence = CompetenciesWorkspace["evidence"][number];
export type CompetencyProfile = CompetenciesWorkspace["profiles"][number];
export type CompetencyAction = CompetenciesWorkspace["actions"][number];
export type CompetenciesCommand = Parameters<
  typeof ApiClient.api.competenciesControllerExecuteCompetenciesCommand
>[0];
export type ExecuteCompetenciesCommand = (command: CompetenciesCommand) => Promise<unknown>;
