import type { ApiClient } from "~/api/api-client";

type ResponseData<T extends (...args: never[]) => Promise<{ data: { data: unknown } }>> = Awaited<
  ReturnType<T>
>["data"]["data"];

export type CompetenciesSummary = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetenciesSummary
>;
export type CompetencySubjectWorkspace = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencySubject
>;
export type CompetencyCatalogPage = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencyCatalog
>;
export type CompetencyCatalogItem = CompetencyCatalogPage["data"][number];
export type CompetencyCategory = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencyCategories
>["data"][number];
export type CompetencyProfileItem = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencyProfiles
>["data"][number];
export type CompetencyPeoplePage = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencyPeople
>;
export type CompetencyPersonReadiness = CompetencyPeoplePage["data"][number];
export type CompetencyReadiness = CompetencyPersonReadiness["readiness"];
export type CompetencyMatrixPage = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencyMatrix
>;
export type CompetencyReviewItem = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencyReviews
>["data"][number];
export type CompetencyOptions = ResponseData<
  typeof ApiClient.api.competenciesControllerGetCompetencyOptions
>;

export type Competency = CompetencySubjectWorkspace["competencies"][number];
export type CompetencyLevel = Competency["levels"][number];
export type CompetencyCondition = CompetencyLevel["conditions"][number];
export type CompetencyStanding = CompetencySubjectWorkspace["standings"][number];
export type CompetencyConditionAssessment =
  CompetencyStanding["levels"][number]["conditions"][number];
export type CompetencyEvidence = CompetencySubjectWorkspace["evidence"][number];
export type CompetencyConditionOverride = CompetencySubjectWorkspace["overrides"][number];
export type CompetencyProfile = NonNullable<CompetencySubjectWorkspace["profile"]>;

export type CompetenciesCommand = Parameters<
  typeof ApiClient.api.competenciesControllerExecuteCompetenciesCommand
>[0];
export type CompetencyInput = Extract<
  CompetenciesCommand,
  { operation: "save_competency" }
>["value"];

export type CompetencyProfileInput = Extract<
  CompetenciesCommand,
  { operation: "save_profile" }
>["value"];
export type CompetencyReviewDecision = Extract<
  CompetenciesCommand,
  { operation: "review_evidence" }
>["decision"];

export type CompetencyDocumentStep = {
  definition: Competency;
  level: CompetencyLevel;
  condition: CompetencyCondition;
  pending: boolean;
};

export type CompetencyDocumentGroup = {
  definition: Competency;
  steps: CompetencyDocumentStep[];
  submissions: CompetencyEvidence[];
};
