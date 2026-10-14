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
import type {
  COURSE_TRANSFER_RESOURCE_GROUPS,
  COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS,
} from "src/course-transfer/course-transfer.constants";
import type {
  CourseTransferCourseDestination,
  CourseTransferPolicy,
} from "src/course-transfer/course-transfer.types";
import type { CourseTransferSnapshotService } from "src/course-transfer/services/course-transfer-snapshot.service";
import type { CoursesSettings } from "src/courses/types/settings";
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
  resourceEntity,
  resources,
  scormPackages,
  scormScos,
} from "src/storage/schema";
type ResourceWithRelation = {
  resource: ResourceSelect;
  relation: ResourceEntitySelect;
};

export type CourseTransferResourceGroupKey =
  (typeof COURSE_TRANSFER_RESOURCE_GROUPS)[keyof typeof COURSE_TRANSFER_RESOURCE_GROUPS];

export type CourseTransferResourceEntityType = Extract<
  EntityType,
  "course" | "chapter" | "lesson" | "question" | "assessment_question"
>;

export type CourseTransferExternalResourceEntityType = Extract<
  EntityType,
  "course" | "lesson" | "assessment_question"
>;

export type CourseTransferInternalResourceEntityType = Extract<
  EntityType,
  "course" | "lesson" | "question"
>;

export type CourseTransferResourceReferenceKind =
  (typeof COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS)[keyof typeof COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS];

export type CourseTransferCopySourceReference = {
  reference: string;
  contentType?: string | null;
  filename?: string | null;
  isVideo?: boolean;
};

type CourseTransferResourceReferenceBase = {
  group: CourseTransferResourceGroupKey;
  source: {
    entityType: CourseTransferResourceEntityType;
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

export type CourseTransferExternalResourceReference = CourseTransferResourceReferenceBase & {
  kind: typeof COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS.EXTERNAL;
  source: CourseTransferResourceReferenceBase["source"] & {
    resourceId: string;
    relationshipType: ResourceRelationshipType | string;
    resource: ResourceSelect;
    relation?: ResourceEntitySelect;
  };
  target: CourseTransferResourceReferenceBase["target"] & {
    resourceId: string | null;
    relationshipType: ResourceRelationshipType | string;
  };
};

export type CourseTransferInternalResourceReference = CourseTransferResourceReferenceBase & {
  kind: typeof COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS.INTERNAL;
  source: CourseTransferResourceReferenceBase["source"] & {
    fieldPath: string;
  };
};

export type CourseTransferResourceReferences = {
  external: Record<string, CourseTransferExternalResourceReference>;
  internal: Record<string, CourseTransferInternalResourceReference>;
};

export type CourseTransferResourceCollection = Record<
  CourseTransferResourceGroupKey,
  CourseTransferResourceReferences
>;

export type CourseSelect = InferSelectModel<typeof courses>;

export type CourseInsert = InferInsertModel<typeof courses>;

export type CourseJsonbInsert = Omit<
  CourseInsert,
  "title" | "description" | "settings" | "authorMetadata"
> & {
  title: SQL<unknown>;
  description: SQL<unknown>;
  settings: SQL<unknown>;
  authorMetadata?: SQL<unknown> | null;
};

export type CourseJsonbUpdate = Partial<
  Omit<CourseInsert, "title" | "description" | "settings" | "authorMetadata">
> & {
  title?: SQL<unknown>;
  description?: SQL<unknown>;
  settings?: SQL<unknown>;
  authorMetadata?: SQL<unknown> | null;
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

export type DuplicateChaptersParams = {
  sourceSnapshot: SourceSnapshot;
  targetCourseId: UUIDType;
  targetAuthorId: UUIDType;
};

export type DuplicateLessonsParams = {
  sourceSnapshot: SourceSnapshot;
  chapterMap: Map<UUIDType, UUIDType>;
  resourceCollection: CourseTransferResourceCollection;
};

export type DuplicateQuestionsParams = {
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  targetAuthorId: UUIDType;
  resourceCollection: CourseTransferResourceCollection;
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
  targetPackageIds?: UUIDType[];
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

export type AiMentorLessonJsonbInsert = Omit<AiMentorLessonInsert, "name"> & {
  name: SQL<unknown>;
};

export type AiMentorLessonJsonbUpdate = Partial<Omit<AiMentorLessonInsert, "name">> & {
  name?: SQL<unknown>;
};

export type AiMentorConfigurationSelect = InferSelectModel<typeof aiMentorConfigurations>;

export type AiMentorConfigurationInsert = InferInsertModel<typeof aiMentorConfigurations>;

export type AiMentorConfigurationJsonbInsert = Omit<
  AiMentorConfigurationInsert,
  "openingInstruction" | "additionalInstructions"
> & {
  openingInstruction?: SQL<unknown> | null;
  additionalInstructions?: SQL<unknown> | null;
};

export type AiMentorConfigurationJsonbUpdate = Partial<
  Omit<AiMentorConfigurationInsert, "openingInstruction" | "additionalInstructions">
> & {
  openingInstruction?: SQL<unknown> | null;
  additionalInstructions?: SQL<unknown> | null;
};

export type AiMentorTeacherConfigurationSelect = InferSelectModel<
  typeof aiMentorTeacherConfigurations
>;

export type AiMentorTeacherConfigurationInsert = InferInsertModel<
  typeof aiMentorTeacherConfigurations
>;

export type AiMentorTeacherConfigurationJsonbInsert = Omit<
  AiMentorTeacherConfigurationInsert,
  "taskGoal" | "expertise" | "contentScope" | "feedbackGuidance"
> & {
  taskGoal: SQL<unknown>;
  expertise: SQL<unknown>;
  contentScope: SQL<unknown>;
  feedbackGuidance?: SQL<unknown> | null;
};

export type AiMentorRoleplayConfigurationSelect = InferSelectModel<
  typeof aiMentorRoleplayConfigurations
>;

export type AiMentorRoleplayConfigurationInsert = InferInsertModel<
  typeof aiMentorRoleplayConfigurations
>;

export type AiMentorRoleplayConfigurationJsonbInsert = Omit<
  AiMentorRoleplayConfigurationInsert,
  "scenario" | "aiRole" | "learnerRole" | "characterGoal" | "factsAndConstraints"
> & {
  scenario: SQL<unknown>;
  aiRole: SQL<unknown>;
  learnerRole: SQL<unknown>;
  characterGoal: SQL<unknown>;
  factsAndConstraints?: SQL<unknown> | null;
};

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

export type CreateTargetCourseFromSourceParams = {
  targetCourseId: UUIDType;
  exportId: UUIDType;
  sourceTenantId: UUIDType;
  sourceSnapshot: SourceSnapshot;
  sourceLanguage: string;
  courseSettings: CoursesSettings;
  categoryId: UUIDType;
  targetAuthorId: UUIDType;
  resourceCollection: CourseTransferResourceCollection;
};

export type UpdateTargetCourseFromSourceParams = {
  targetCourseId: UUIDType;
  sourceSnapshot: SourceSnapshot;
  sourceLanguage: string;
  courseSettings: CoursesSettings;
  categoryId: UUIDType;
  sourceTenantId: UUIDType;
  resourceCollection: CourseTransferResourceCollection;
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
  resourceCollection: CourseTransferResourceCollection;
};

export type SyncQuestionsParams = {
  exportId: UUIDType;
  sourceLanguage: string;
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  targetAuthorId: UUIDType;
  resourceCollection: CourseTransferResourceCollection;
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
  resourceCollection: CourseTransferResourceCollection;
};

export type SyncScormPackagesParams = {
  scormPackages: CourseTransferPreparedScormPackage[];
  sourceSnapshot: SourceSnapshot;
  lessonMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
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
  resourceCollection: CourseTransferResourceCollection;
  targetTenantHost: string;
};

export type SyncFillInTheBlanksQuestionReferencesParams = {
  sourceSnapshot: SourceSnapshot;
  questionMap: Map<UUIDType, UUIDType>;
  optionMap: Map<UUIDType, UUIDType>;
  blankMap: Map<UUIDType, UUIDType>;
};

export type AddExternalResourceReferenceParams = {
  group: CourseTransferResourceGroupKey;
  sourceEntityType: CourseTransferExternalResourceEntityType;
  sourceEntityId: UUIDType;
  relationshipType: string;
  resource: ResourceSelect;
  relation?: ResourceEntitySelect;
};

export type AddInternalResourceReferenceParams = {
  group: CourseTransferResourceGroupKey;
  sourceEntityType: CourseTransferInternalResourceEntityType;
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
  uploadedResourceIdsByFileKey?: ReadonlyMap<string, UUIDType>;
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
  resourceCollection: CourseTransferResourceCollection;
};

export type DuplicateResourcesParams = {
  lessonMap: Map<UUIDType, UUIDType>;
  questionMap: Map<UUIDType, UUIDType>;
  targetCourseId: UUIDType;
  targetTenantId: UUIDType;
  targetAuthorId: UUIDType;
  resourceCollection: CourseTransferResourceCollection;
  uploadedResourceIdsByFileKey?: ReadonlyMap<string, UUIDType>;
};

export type CourseTransferPreparedScormPackage = {
  sourcePackage: SourceSnapshot["scormPackages"][number];
  targetPackageId: UUIDType;
  targetOriginalFileReference: string;
  targetExtractedFilesReference: string;
};

export type CourseTransferPrepareCourseInput = {
  snapshot: SourceSnapshot;
  sourceTenantId: UUIDType;
  destination: CourseTransferCourseDestination;
  policy: CourseTransferPolicy;
};

export type CourseTransferPreparedCourse = {
  snapshot: SourceSnapshot;
  resourceCollection: CourseTransferResourceCollection;
  scormPackages: CourseTransferPreparedScormPackage[];
  source: { tenantId: UUIDType; host: string };
  destination: CourseTransferCourseDestination & { host: string };
};

export type CourseTransferLearningPathSnapshot = NonNullable<
  Awaited<ReturnType<CourseTransferSnapshotService["readLearningPath"]>>
>;

export type CourseTransferPreparedLearningPathCourse = {
  sourceCourseId: UUIDType;
  targetCourseId: UUIDType;
};

export type CourseTransferMaterializeLearningPathInput = {
  exportId: UUIDType;
  sourceTenantId: UUIDType;
  targetTenantId: UUIDType;
  snapshot: CourseTransferLearningPathSnapshot;
  courses: CourseTransferPreparedLearningPathCourse[];
};
