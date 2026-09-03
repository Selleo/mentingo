import type { CoursesSettings } from "./settings";
import type {
  AssessmentGradingMode,
  AssessmentQuestionType,
  AssessmentTextComparisonMode,
  EntityType,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { ResourceRelationshipType } from "src/file/file.constants";
import type {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
  assessmentQuestionBlankAnswerSets,
  assessmentQuestionBlanks,
  assessmentQuestionDragAndDropOptions,
  assessmentQuestionOpenTextSettings,
  assessmentQuestionScaleOptions,
  assessmentQuestionTrueFalseStatements,
  assessments,
  categories,
  chapters,
  courses,
  docChunks,
  documents,
  documentToAiMentorLesson,
  lessons,
  masterCourseExports,
  resourceEntity,
  resources,
  scormPackages,
  scormScos,
} from "src/storage/schema";

type ResourceWithRelation = {
  resource: ResourceSelect;
  relation: ResourceEntitySelect;
};

export type MasterCourseResourceGroupKey = "courses" | "chapters" | "lessons" | "questions";
export type MasterCourseResourceEntityType = Extract<
  EntityType,
  "course" | "chapter" | "lesson" | "question" | "assessment_question"
>;
export type MasterCourseExternalResourceEntityType = Extract<
  EntityType,
  "course" | "lesson" | "assessment_question"
>;
export type MasterCourseInternalResourceEntityType = Extract<
  EntityType,
  "course" | "lesson" | "question"
>;

export const MASTER_COURSE_RESOURCE_REFERENCE_KIND = {
  EXTERNAL: "external",
  INTERNAL: "internal",
} as const;

export type MasterCourseResourceReferenceKind =
  (typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND)[keyof typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND];

export type MasterCourseCopySourceReference = {
  reference: string;
  contentType?: string | null;
  filename?: string | null;
  isVideo?: boolean;
};

type MasterCourseResourceReferenceBase = {
  group: MasterCourseResourceGroupKey;
  source: {
    entityType: MasterCourseResourceEntityType;
    entityId: string;
    reference: string;
    contentType?: string | null;
    filename?: string | null;
    isVideo?: boolean;
  };
  target: {
    entityId: string | null;
    reference: string | null;
  };
};

export type MasterCourseExternalResourceReference = MasterCourseResourceReferenceBase & {
  kind: typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND.EXTERNAL;
  source: MasterCourseResourceReferenceBase["source"] & {
    resourceId: string;
    relationshipType: ResourceRelationshipType | string;
    resource: ResourceSelect;
    relation?: ResourceEntitySelect;
  };
  target: MasterCourseResourceReferenceBase["target"] & {
    resourceId: string | null;
    relationshipType: ResourceRelationshipType | string;
  };
};

export type MasterCourseInternalResourceReference = MasterCourseResourceReferenceBase & {
  kind: typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND.INTERNAL;
  source: MasterCourseResourceReferenceBase["source"] & {
    fieldPath: string;
  };
};

export type MasterCourseResourceReferences = {
  external: Record<string, MasterCourseExternalResourceReference>;
  internal: Record<string, MasterCourseInternalResourceReference>;
};

export type MasterCourseResourceCollection = Record<
  MasterCourseResourceGroupKey,
  MasterCourseResourceReferences
>;

export type CourseSelect = InferSelectModel<typeof courses>;
export type CourseInsert = InferInsertModel<typeof courses>;
export type CourseJsonbInsert = Omit<CourseInsert, "title" | "description" | "settings"> & {
  title: SQL<unknown>;
  description: SQL<unknown>;
  settings: SQL<unknown>;
};
export type CourseJsonbUpdate = Partial<
  Omit<CourseInsert, "title" | "description" | "settings">
> & {
  title?: SQL<unknown>;
  description?: SQL<unknown>;
  settings?: SQL<unknown>;
};

export type CategorySelect = InferSelectModel<typeof categories>;
export type CategoryInsert = InferInsertModel<typeof categories>;
export type CategoryJsonbInsert = Omit<CategoryInsert, "title"> & {
  title: SQL<unknown>;
};
export type CategoryJsonbUpdate = Partial<Omit<CategoryInsert, "title">> & {
  title?: SQL<unknown>;
};

export type ChapterSelect = InferSelectModel<typeof chapters>;
export type ChapterInsert = InferInsertModel<typeof chapters>;
export type ChapterJsonbInsert = Omit<ChapterInsert, "title"> & {
  title: SQL<unknown>;
};
export type ChapterJsonbUpdate = Partial<Omit<ChapterInsert, "title">> & {
  title?: SQL<unknown>;
};

export type LessonSelect = InferSelectModel<typeof lessons>;
export type LessonInsert = InferInsertModel<typeof lessons>;
export type LessonJsonbInsert = Omit<LessonInsert, "title" | "description"> & {
  title: SQL<unknown>;
  description?: SQL<unknown> | null;
};
export type LessonJsonbUpdate = Partial<Omit<LessonInsert, "title" | "description">> & {
  title?: SQL<unknown>;
  description?: SQL<unknown> | null;
};

export type QuestionSelect = {
  id: UUIDType;
  lessonId: UUIDType;
  type: AssessmentQuestionType;
  title: LocalizedText | null;
  description: LocalizedText | null;
  prompt: LocalizedText;
  solutionExplanation: LocalizedText | null;
  displayOrder: number;
  photoS3Key: string | null;
  gradingMode: AssessmentGradingMode;
  authorId: UUIDType | null;
  createdAt: string;
  updatedAt: string;
  tenantId: UUIDType;
};
export type QuestionInsert = Omit<QuestionSelect, "id" | "createdAt" | "updatedAt" | "tenantId">;
export type QuestionJsonbInsert = Omit<
  QuestionInsert,
  "prompt" | "title" | "description" | "solutionExplanation"
> & {
  prompt: SQL<unknown>;
  title: SQL<unknown>;
  description?: SQL<unknown> | null;
  solutionExplanation?: SQL<unknown> | null;
};
export type QuestionJsonbUpdate = Partial<
  Omit<QuestionInsert, "prompt" | "title" | "description" | "solutionExplanation">
> & {
  prompt?: SQL<unknown>;
  title?: SQL<unknown>;
  description?: SQL<unknown> | null;
  solutionExplanation?: SQL<unknown> | null;
};

export type QuestionAnswerOptionSelect = {
  id: UUIDType;
  questionId: UUIDType;
  optionText: LocalizedText | null;
  matchedWord: LocalizedText | null;
  isCorrect: boolean;
  displayOrder: number;
  scaleAnswer: number | null;
  createdAt: string;
  updatedAt: string;
  tenantId: UUIDType;
};
export type QuestionAnswerOptionInsert = Omit<
  QuestionAnswerOptionSelect,
  "id" | "createdAt" | "updatedAt" | "tenantId"
>;

export type AssessmentQuestionBlankSelect = InferSelectModel<typeof assessmentQuestionBlanks>;
export type AssessmentQuestionBlankAnswerSetSelect = InferSelectModel<
  typeof assessmentQuestionBlankAnswerSets
>;
export type AssessmentQuestionDragAndDropOptionSelect = InferSelectModel<
  typeof assessmentQuestionDragAndDropOptions
>;
export type AssessmentQuestionScaleOptionSelect = InferSelectModel<
  typeof assessmentQuestionScaleOptions
>;
export type AssessmentQuestionTrueFalseStatementSelect = InferSelectModel<
  typeof assessmentQuestionTrueFalseStatements
>;
export type AssessmentQuestionOpenTextSettingsSelect = InferSelectModel<
  typeof assessmentQuestionOpenTextSettings
>;
export type AssessmentQuestionOpenTextSettingsValues = {
  questionId: UUIDType;
  minimumCharacters: number | null;
  maximumCharacters: number | null;
  reviewerInstructions: string | null;
};
export type AssessmentUpsertValues = Pick<
  AssessmentSelect,
  | "lessonId"
  | "passingScorePercentage"
  | "attemptLimitMode"
  | "maximumAttempts"
  | "attemptCooldown"
  | "feedbackMode"
  | "baseLanguage"
  | "availableLocales"
>;
export type AssessmentSelect = InferSelectModel<typeof assessments>;

export type UpsertTargetBlankValues = {
  id: UUIDType;
  questionId: UUIDType;
  textComparisonMode: AssessmentTextComparisonMode;
};

export type UpsertTargetBlankAnswerSetValues = {
  blankId: UUIDType;
  language: SupportedLanguages;
  preferredAnswer: string;
  acceptedAnswers: string[];
};

export type UpsertTargetDragAndDropOptionValues = {
  id: UUIDType;
  questionId: UUIDType;
  language: SupportedLanguages;
  label: string;
  targetBlankId: UUIDType | null;
  displayOrder: number;
};

export type UpsertTargetScaleOptionValues = {
  id: UUIDType;
  questionId: UUIDType;
  scaleValue: number;
  displayOrder: number;
  label: LocalizedText;
};

export type UpsertTargetTrueFalseStatementValues = {
  id: UUIDType;
  questionId: UUIDType;
  language: SupportedLanguages;
  displayOrder: number;
  correctValue: boolean;
  statement: string;
};

export type DeleteStaleTargetQuestionDetailsValues = {
  questionIds: UUIDType[];
  scaleOptionIds: UUIDType[];
  trueFalseStatementIds: UUIDType[];
  blankIds: UUIDType[];
  dragAndDropOptionIds: UUIDType[];
};

export type DuplicateCourseIntoExistingCourseParams = {
  sourceCourseId: UUIDType;
  targetCourseId: UUIDType;
  actorId: UUIDType;
  tenantId: UUIDType;
};

export type DuplicateChaptersParams = {
  sourceSnapshot: SourceSnapshot;
  targetCourseId: UUIDType;
  targetAuthorId: UUIDType;
};

export type DuplicateLessonsParams = {
  sourceSnapshot: SourceSnapshot;
  chapterMap: Map<UUIDType, UUIDType>;
  resourceCollection: MasterCourseResourceCollection;
};

export type DuplicateQuestionsParams = {
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  targetAuthorId: UUIDType;
  resourceCollection: MasterCourseResourceCollection;
};

export type DuplicateOptionsParams = {
  sourceSnapshot: SourceSnapshot;
  questionMap: Map<UUIDType, UUIDType>;
};

export type SyncAssessmentQuestionDetailsParams = {
  sourceSnapshot: SourceSnapshot;
  questionMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
};

export type RemoveScormPackagesForMappedTargetsParams = {
  targetCourseId: UUIDType;
  targetLessonIds: UUIDType[];
};
export type QuestionAnswerOptionJsonbInsert = Omit<
  QuestionAnswerOptionInsert,
  "optionText" | "matchedWord"
> & {
  optionText: SQL<unknown>;
  matchedWord?: SQL<unknown> | null;
};
export type QuestionAnswerOptionJsonbUpdate = Partial<
  Omit<QuestionAnswerOptionInsert, "optionText" | "matchedWord">
> & {
  optionText?: SQL<unknown>;
  matchedWord?: SQL<unknown> | null;
};

export type AiMentorLessonSelect = InferSelectModel<typeof aiMentorLessons>;
export type AiMentorLessonInsert = InferInsertModel<typeof aiMentorLessons>;
export type AiMentorConfigurationSelect = InferSelectModel<typeof aiMentorConfigurations>;
export type AiMentorConfigurationInsert = InferInsertModel<typeof aiMentorConfigurations>;
export type AiMentorTeacherConfigurationSelect = InferSelectModel<
  typeof aiMentorTeacherConfigurations
>;
export type AiMentorTeacherConfigurationInsert = InferInsertModel<
  typeof aiMentorTeacherConfigurations
>;
export type AiMentorRoleplayConfigurationSelect = InferSelectModel<
  typeof aiMentorRoleplayConfigurations
>;
export type AiMentorRoleplayConfigurationInsert = InferInsertModel<
  typeof aiMentorRoleplayConfigurations
>;
export type AiJudgeConfigurationSelect = InferSelectModel<typeof aiJudgeConfigurations>;
export type AiJudgeConfigurationInsert = InferInsertModel<typeof aiJudgeConfigurations>;
export type AiJudgeConfigurationJsonbInsert = Omit<AiJudgeConfigurationInsert, "taskGoal"> & {
  taskGoal: SQL<unknown>;
};
export type AiJudgeConfigurationJsonbUpdate = Partial<
  Omit<AiJudgeConfigurationInsert, "taskGoal">
> & {
  taskGoal?: SQL<unknown>;
};
export type AiJudgeCriterionSelect = InferSelectModel<typeof aiJudgeCriteria>;
export type AiJudgeCriterionInsert = InferInsertModel<typeof aiJudgeCriteria>;
export type AiJudgeCriterionJsonbInsert = Omit<
  AiJudgeCriterionInsert,
  "title" | "expectedBehavior"
> & {
  title: SQL<unknown>;
  expectedBehavior: SQL<unknown>;
};
export type AiJudgeScoreGuidanceSelect = InferSelectModel<typeof aiJudgeScoreGuidance>;
export type AiJudgeScoreGuidanceInsert = InferInsertModel<typeof aiJudgeScoreGuidance>;
export type AiJudgeScoreGuidanceJsonbInsert = Omit<
  AiJudgeScoreGuidanceInsert,
  "description" | "example"
> & {
  description: SQL<unknown>;
  example?: SQL<unknown> | null;
};
export type AiJudgeBlockingErrorSelect = InferSelectModel<typeof aiJudgeBlockingErrors>;
export type AiJudgeBlockingErrorInsert = InferInsertModel<typeof aiJudgeBlockingErrors>;
export type AiJudgeBlockingErrorJsonbInsert = Omit<AiJudgeBlockingErrorInsert, "description"> & {
  description: SQL<unknown>;
};

export type DocumentSelect = InferSelectModel<typeof documents>;
export type DocumentInsert = InferInsertModel<typeof documents>;

export type DocChunkSelect = InferSelectModel<typeof docChunks>;
export type DocChunkInsert = InferInsertModel<typeof docChunks>;

export type DocumentToAiMentorLessonSelect = InferSelectModel<typeof documentToAiMentorLesson>;
export type DocumentToAiMentorLessonInsert = InferInsertModel<typeof documentToAiMentorLesson>;

export type ResourceSelect = InferSelectModel<typeof resources>;
export type ResourceInsert = InferInsertModel<typeof resources>;
export type ResourceJsonbInsert = Omit<ResourceInsert, "metadata"> & {
  metadata: SQL<unknown>;
};

export type ResourceEntitySelect = InferSelectModel<typeof resourceEntity>;
export type ResourceEntityInsert = InferInsertModel<typeof resourceEntity>;

export type ScormPackageSelect = InferSelectModel<typeof scormPackages>;
export type ScormPackageInsert = InferInsertModel<typeof scormPackages>;

export type ScormScoSelect = InferSelectModel<typeof scormScos>;
export type ScormScoInsert = InferInsertModel<typeof scormScos>;

export type MasterCourseExportRecord = InferSelectModel<typeof masterCourseExports>;

export type SourceSnapshot = {
  course: CourseSelect;
  category: CategorySelect;
  categoryBaseTitle: string;
  chapters: Array<ChapterSelect>;
  lessons: Array<LessonSelect>;
  questions: Array<QuestionSelect>;
  options: Array<QuestionAnswerOptionSelect>;
  assessmentQuestionBlanks: Array<AssessmentQuestionBlankSelect>;
  assessmentQuestionBlankAnswerSets: Array<AssessmentQuestionBlankAnswerSetSelect>;
  assessmentQuestionDragAndDropOptions: Array<AssessmentQuestionDragAndDropOptionSelect>;
  assessmentQuestionScaleOptions: Array<AssessmentQuestionScaleOptionSelect>;
  assessmentQuestionTrueFalseStatements: Array<AssessmentQuestionTrueFalseStatementSelect>;
  questionResources: Array<ResourceWithRelation>;
  assessmentQuestionOpenTextSettings: Array<AssessmentQuestionOpenTextSettingsSelect>;
  assessments: Array<AssessmentSelect>;
  aiMentors: Array<AiMentorLessonSelect>;
  aiMentorConfigurations: Array<AiMentorConfigurationSelect>;
  aiMentorTeacherConfigurations: Array<AiMentorTeacherConfigurationSelect>;
  aiMentorRoleplayConfigurations: Array<AiMentorRoleplayConfigurationSelect>;
  aiJudgeConfigurations: Array<AiJudgeConfigurationSelect>;
  aiJudgeCriteria: Array<AiJudgeCriterionSelect>;
  aiJudgeScoreGuidance: Array<AiJudgeScoreGuidanceSelect>;
  aiJudgeBlockingErrors: Array<AiJudgeBlockingErrorSelect>;
  aiMentorDocumentLinks: Array<DocumentToAiMentorLessonSelect>;
  aiMentorDocuments: Array<DocumentSelect>;
  aiMentorDocChunks: Array<DocChunkSelect>;
  scormPackages: Array<ScormPackageSelect>;
  scormScos: Array<ScormScoSelect>;
  lessonContentResources: Array<ResourceSelect>;
  lessonResources: Array<ResourceWithRelation>;
  courseResources: Array<ResourceWithRelation>;
};

export type EnsureCourseExportSyncedParams = {
  sourceCourseId: UUIDType;
  sourceTenantId: UUIDType;
  targetTenantId: UUIDType;
};

export type CreateTargetCourseFromSourceParams = {
  targetCourseId: UUIDType;
  exportLink: MasterCourseExportRecord;
  sourceSnapshot: SourceSnapshot;
  sourceLanguage: string;
  courseSettings: CoursesSettings;
  categoryId: UUIDType;
  targetAuthorId: UUIDType;
  resourceCollection: MasterCourseResourceCollection;
};

export type UpdateTargetCourseFromSourceParams = {
  targetCourseId: UUIDType;
  sourceSnapshot: SourceSnapshot;
  sourceLanguage: string;
  courseSettings: CoursesSettings;
  categoryId: UUIDType;
  sourceTenantId: UUIDType;
  resourceCollection: MasterCourseResourceCollection;
  targetAuthorId: UUIDType;
};

export type SyncChaptersParams = {
  exportId: UUIDType;
  sourceLanguage: string;
  sourceSnapshot: SourceSnapshot;
  targetCourseId: UUIDType;
  targetAuthorId: UUIDType;
};

export type SyncLessonsParams = {
  exportId: UUIDType;
  sourceLanguage: string;
  sourceSnapshot: SourceSnapshot;
  chapterMap: Map<UUIDType, UUIDType>;
  resourceCollection: MasterCourseResourceCollection;
};

export type SyncQuestionsParams = {
  exportId: UUIDType;
  sourceLanguage: string;
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  targetAuthorId: UUIDType;
  resourceCollection: MasterCourseResourceCollection;
};

export type SyncOptionsParams = {
  exportId: UUIDType;
  sourceLanguage: string;
  sourceSnapshot: SourceSnapshot;
  questionMap: Map<UUIDType, UUIDType>;
};

export type SyncAiMentorsParams = {
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  resourceCollection: MasterCourseResourceCollection;
};

export type SyncScormPackagesParams = {
  exportId: UUIDType;
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
  targetTenantId: UUIDType;
};

export type GetTargetScormPackageEntityIdParams = {
  lessonMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
};

export type CopyScormPackageStorageParams = {
  sourceOriginalFileReference: string;
  targetOriginalFileReference: string;
  sourceExtractedFilesReference: string;
  targetExtractedFilesReference: string;
};

export type SyncLessonResourceReferencesParams = {
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  resourceCollection: MasterCourseResourceCollection;
  targetTenantHost: string;
};

export type SyncFillInTheBlanksQuestionReferencesParams = {
  sourceSnapshot: SourceSnapshot;
  questionMap: Map<UUIDType, UUIDType>;
  optionMap: Map<UUIDType, UUIDType>;
  blankMap: Map<UUIDType, UUIDType>;
};

export type AddExternalResourceReferenceParams = {
  group: MasterCourseResourceGroupKey;
  sourceEntityType: MasterCourseExternalResourceEntityType;
  sourceEntityId: UUIDType;
  relationshipType: string;
  resource: ResourceSelect;
  relation?: ResourceEntitySelect;
};

export type AddInternalResourceReferenceParams = {
  group: MasterCourseResourceGroupKey;
  sourceEntityType: MasterCourseInternalResourceEntityType;
  sourceEntityId: UUIDType;
  fieldPath: string;
  reference: unknown;
  contentType?: string | null;
  filename?: string | null;
  isVideo?: boolean;
};

export type CopySourceResourceReferencesParams = {
  targetCourseId: UUIDType;
  sourceTenantId: UUIDType;
  sourceTenantOrigin: string;
  targetTenantId: UUIDType;
};

export type ResolveTargetResourceReferenceParams = CopySourceResourceReferencesParams & {
  targetBunnyConfigured: boolean;
  sourceAndTargetShareBunnyMediaConfiguration: boolean;
  copiedReferences: Map<string, string>;
};

export type CopyVideoReferenceParams = Omit<
  ResolveTargetResourceReferenceParams,
  "copiedReferences"
>;

export type BuildCopiedResourceReferenceParams = {
  targetCourseId: UUIDType;
  targetTenantId: UUIDType;
  fallbackExtension?: string;
};

export type GetTargetResourceEntityIdParams = {
  lessonMap: Map<UUIDType, UUIDType>;
  questionMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
};

export type SyncResourcesParams = {
  exportId: UUIDType;
  lessonMap: Map<UUIDType, UUIDType>;
  questionMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
  targetTenantId: UUIDType;
  targetAuthorId: UUIDType;
  resourceCollection: MasterCourseResourceCollection;
};

export type DuplicateResourcesParams = {
  lessonMap: Map<UUIDType, UUIDType>;
  questionMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
  targetTenantId: UUIDType;
  targetAuthorId: UUIDType;
  resourceCollection: MasterCourseResourceCollection;
};

export type CreateOrQueueExportForTargetParams = {
  sourceCourseId: UUIDType;
  sourceTenantId: UUIDType;
  targetTenantId: UUIDType;
  actorId: UUIDType;
};
