/** UI contracts for the authoring session, projection, native operations, and review state. */
import type {
  AUTHORING_APPLICATION_STATUS,
  AUTHORING_ARTIFACT_KIND,
  AUTHORING_CHAPTER_PROGRESS_STATUS,
  AUTHORING_CONNECTION_STATE,
  AUTHORING_FAILURE_CATEGORY,
  AUTHORING_LESSON_KIND,
  AUTHORING_OUTLINE_PHASE,
  AUTHORING_PART_KIND,
  AUTHORING_PART_STATUS,
  AUTHORING_RECOVERY_ACTION,
  AUTHORING_SESSION_STATUS,
  AUTHORING_SOURCE_REFRESH_STATUS,
  AUTHORING_SOURCE_STATUS,
  AUTHORING_TASK_STATUS,
  AUTHORING_TOOL_STATUS,
  AUTHORING_TURN_STATUS,
  AUTHORING_WORK_PROGRESS_STAGE,
} from "./courseAuthoring.constants";
import type {
  CURRICULUM_PREVIEW_STATUS,
  PROPOSAL_DECISION,
} from "./review/curriculumReview.constants";
import type { ReviewProposal } from "./review/curriculumReview.types";
import type { SupportedLanguages } from "@repo/shared";

export type AuthoringSessionStatus =
  (typeof AUTHORING_SESSION_STATUS)[keyof typeof AUTHORING_SESSION_STATUS];
export type AuthoringTaskStatus =
  (typeof AUTHORING_TASK_STATUS)[keyof typeof AUTHORING_TASK_STATUS];

export type AuthoringWorkProgressStage =
  (typeof AUTHORING_WORK_PROGRESS_STAGE)[keyof typeof AUTHORING_WORK_PROGRESS_STAGE];

export type AuthoringWorkProgressChapter = {
  chapterId: string;
  title: string;
  lessonCount: number;
  status: (typeof AUTHORING_CHAPTER_PROGRESS_STATUS)[keyof typeof AUTHORING_CHAPTER_PROGRESS_STATUS];
  failureCode?: string;
};

export type AuthoringWorkProgress = {
  stage: AuthoringWorkProgressStage;
  outlinePhase?: (typeof AUTHORING_OUTLINE_PHASE)[keyof typeof AUTHORING_OUTLINE_PHASE];
  outlineIteration?: number;
  draftedChapters?: number;
  draftedLessons?: number;
  completedSteps?: number;
  totalSteps?: number;
  chapters?: AuthoringWorkProgressChapter[];
  completedLessons?: number;
  totalLessons?: number;
  lessonId?: string;
  lessonTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
  failedLessonIds?: string[];
  repairAttempt?: number;
  repairLimit?: number;
};

export type AuthoringTaskFailure = {
  code: string;
  category: (typeof AUTHORING_FAILURE_CATEGORY)[keyof typeof AUTHORING_FAILURE_CATEGORY];
  stage: string;
  recoveryAction: (typeof AUTHORING_RECOVERY_ACTION)[keyof typeof AUTHORING_RECOVERY_ACTION];
  retryable: boolean;
  affectedChapterIds: string[];
  affectedLessonIds: string[];
  correlationId: string | null;
  detailKey: string | null;
  generationRevision: number;
};

export type AuthoringTask = {
  taskId: string;
  requestId: string;
  /** Task contract kind, when supplied by the authoring snapshot. */
  kind?: string | null;
  phase?: string | null;
  status: AuthoringTaskStatus;
  errorCode: string | null;
  outputId: string | null;
  workProgress?: AuthoringWorkProgress;
  failure?: AuthoringTaskFailure | null;
};

export type AuthoringTurnStatus =
  (typeof AUTHORING_TURN_STATUS)[keyof typeof AUTHORING_TURN_STATUS];

export type AuthoringPartKind = (typeof AUTHORING_PART_KIND)[keyof typeof AUTHORING_PART_KIND];

export type AuthoringTurnPartStatus =
  (typeof AUTHORING_PART_STATUS)[keyof typeof AUTHORING_PART_STATUS];

export type AuthoringTurnPart = {
  requestId: string;
  messageId: string;
  partId: string;
  partKind: AuthoringPartKind;
  taskId?: string | null;
  status: AuthoringTurnPartStatus;
  firstSequence: number;
  updatedSequence: number;
  text?: string | null;
  planSteps?: string[];
  answer?: string | null;
  phase?: string | null;
  tool?: {
    toolCallId: string;
    toolName: string;
    display: string;
    status: (typeof AUTHORING_TOOL_STATUS)[keyof typeof AUTHORING_TOOL_STATUS];
    result?: {
      query?: string | null;
      queries?: string[] | null;
      sources?: { url: string; title: string | null }[];
      sourceCount?: number | null;
      findingCount?: number | null;
    } | null;
  } | null;
  artifact?: {
    artifactKind: (typeof AUTHORING_ARTIFACT_KIND)[keyof typeof AUTHORING_ARTIFACT_KIND];
    artifactId: string;
  } | null;
};

export type AuthoringTurn = {
  requestId: string;
  messageId: string;
  status: AuthoringTurnStatus;
  taskIds: string[];
  parts: AuthoringTurnPart[];
  firstSequence: number;
  updatedSequence: number;
};

export type AuthoringRecord = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
};

export type AuthoringApplicationDelta = {
  appliedOperationIds: string[];
  idMappings: Record<string, string>;
};

export type AuthoringSession = {
  schemaVersion: 1;
  reasoningControlAvailable?: boolean;
  applicationDelta?: AuthoringApplicationDelta;
  sessionId: string;
  courseId: string;
  language: SupportedLanguages;
  status: AuthoringSessionStatus;
  snapshotSequence: number;
  workspaceRevision: number;
  records: AuthoringRecord[];
  tasks: AuthoringTask[];
  turns?: AuthoringTurn[];
  hasMoreTurns?: boolean;
  nextBeforeRequestId?: string | null;
};

export type AuthoringTurnHistoryPage = {
  turns: AuthoringTurn[];
  records: AuthoringRecord[];
  hasMore: boolean;
  nextBeforeRequestId: string | null;
};

/** Compact thread-browser row; load the full timeline only after selection. */
export type AuthoringSessionSummary = Pick<
  AuthoringSession,
  "sessionId" | "courseId" | "language" | "status"
> & {
  title: string;
  createdAt: string;
  lastActivityAt: string;
};

export type AuthoringEvent = {
  schemaVersion: 1;
  eventId: string;
  sessionId: string;
  sequence: number;
  occurredAt: string;
  type: string;
  payload: Record<string, unknown>;
};

export type LessonKind = (typeof AUTHORING_LESSON_KIND)[keyof typeof AUTHORING_LESSON_KIND];

export type OutlineLesson = {
  id: string;
  title: string;
  lessonType: LessonKind;
  objectives: string[];
};

export type OutlineChapter = {
  id: string;
  title: string;
  lessons: OutlineLesson[];
};

export type SourcePolicy = {
  sourceVersionIds: string[];
  webEnabled: boolean;
  generalKnowledgeEnabled: boolean;
  researchDepth: "standard" | "deep";
  requiredSectionIds: string[];
  excludedSectionIds: string[];
};

export type TargetRef = {
  targetId: string;
  kind: "course" | "chapter" | "lesson" | "block" | "question";
  language: SupportedLanguages;
  baselineHash: string | null;
  blockIds: string[];
  allowedFields: string[];
};

export type AuthoringRequest = {
  instruction: string;
  reasoningEffort: "low" | "medium" | "high";
  targets: TargetRef[];
  sourcePolicy: SourcePolicy;
  attachedSourceVersionIds?: string[];
  exactOutline?: OutlineChapter[] | null;
};

export type AuthoringCommand = {
  schemaVersion: 1;
  commandId: string;
  action:
    | "request.create"
    | "session.pause"
    | "session.resume"
    | "session.stop"
    | "request.stop"
    | "request.discard"
    | "task.retry"
    | "question.answer"
    | "proposal.accept"
    | "proposal.reject"
    | "proposal.review"
    | "proposal.regenerate"
    | "proposal.regenerate.batch"
    | "draft.edit"
    | "draft.discard"
    | "sources.select"
    | "source.refresh"
    | "asset.retry_submission";
  request?: AuthoringRequest;
  /** Lesson tasks to regenerate as part of a source refresh. */
  selectedTaskIds?: string[];
  targetId?: string;
  /** Optional server fence for a review group created by one author request. */
  requestId?: string;
  replacementSourceVersionId?: string;
  expectedRevision?: number;
  answer?: string;
  /** Targeted author guidance for regenerating one reviewed proposal. */
  feedback?: string;
  /** Targeted author feedback staged for multiple reviewed proposals in one command. */
  regenerations?: ProposalRegeneration[];
  operations?: AuthoringOperation[];
  sourcePolicy?: SourcePolicy;
  acceptQualityConcerns?: boolean;
  /** A session-locked batch decision for a request-level review group. */
  reviews?: Array<{
    proposalId: string;
    expectedRevision: number;
    accepted: boolean;
    acceptQualityConcerns?: boolean;
  }>;
};

export type ProposalRegeneration = {
  targetId: string;
  expectedRevision: number;
  feedback: string;
};

export type AuthoringOperation = {
  operationId: string;
  targetId: string;
  type: string;
  language?: SupportedLanguages;
  /** Lesson writes retain their chapter binding so draft rows can be previewed in place. */
  chapterId?: string;
  /** Native authoring operations use a zero-based position within their parent collection. */
  displayOrder?: number;
  dependencies: string[];
  payload: Record<string, unknown>;
};

export type ProposalView = {
  id: string;
  revision: number;
  taskId: string | null;
  summary: string;
  rationale: string;
  warnings: string[];
  blockedQuality: boolean;
  qualityConcernsAccepted: boolean;
  evidenceCount: number;
  operations: AuthoringOperation[];
  outline: OutlineChapter[] | null;
  decision: (typeof PROPOSAL_DECISION)[keyof typeof PROPOSAL_DECISION];
  acceptedCommandId?: string | null;
  parentProposalId: string | null;
  manual: boolean;
  protectedEdits: string[];
  assetRequests?: AssetRequestView[];
  assetIds?: string[];
};

export type CurriculumPreview = {
  /** Missing edges are removed only from inspection; original Apply proposals stay unchanged. */
  missingDependencies?: Array<{ operationId: string; dependencyId: string }>;
  proposalId: string;
  /** The durable items represented by a combined course-level review preview. */
  proposalIds?: string[];
  reviewGroupId?: string;
  status: (typeof CURRICULUM_PREVIEW_STATUS)[keyof typeof CURRICULUM_PREVIEW_STATUS];
  operations?: AuthoringOperation[];
  /** Proposals behind the preview, so each change can be accepted or rejected in place. */
  proposals?: ReviewProposal[];
  /** Opens the review on this proposal's first change. */
  focusProposalId?: string;
  courseTitle?: string;
  /** Lessons whose learner attempts are affected when their assessment changes. */
  assessedLessonIds?: string[];
  /** Source catalog used to show attached Mentor files while reviewing a proposal. */
  sources?: SourceView[];
  /** Operation IDs with ready synthesized reference files instead of raw source attachments. */
  targetedMentorOperationIds?: string[];
  /** Session scope for resolving prepared Mentor image assets in the review preview. */
  authoringSessionId?: string;
  /** Asset IDs already uploaded and ready for the review preview. */
  readyAssetIds?: string[];
  outline: Array<{
    id: string;
    title: string;
    /** Zero-based placement supplied by an operation when the proposal has no authored outline. */
    displayOrder?: number;
    lessons: Array<{
      id: string;
      title: string;
      lessonType: string;
      displayOrder?: number;
    }>;
  }>;
};

/** The staged verdicts a curriculum review sends back in one batch. */
export type CurriculumReviewSubmission = {
  acceptedProposalIds: string[];
  rejectedProposalIds: string[];
  acknowledgeAssessmentChanges: boolean;
};

/** Actions that can be completed from the curriculum review surface. */
export type CurriculumPreviewActions = {
  /** Records every staged verdict and applies the accepted changes as one course update. */
  applyReview?: (submission: CurriculumReviewSubmission) => Promise<void>;
  /** Starts one revised conversation turn for the reviewed draft. */
  refineBatch?: (feedbacks: Array<{ proposalId: string; feedback: string }>) => Promise<void>;
};

export type AssetRequestView = {
  assetId: string;
  operationId: string;
  purpose: "thumbnail" | "lesson" | "diagram" | "avatar" | "signature";
  required: boolean;
  altText: string;
  source: { type: "generated"; content: string; visualQuery: string };
};

export type AssetTaskView = {
  taskId: string;
  parentTaskId: string | null;
  request: AssetRequestView;
  status: AuthoringTaskStatus;
  revision: number | null;
  question: string | null;
  action: "asset.retry_submission" | null;
  ready: boolean;
};

export type PreviewView = {
  id: string;
  taskId: string;
  requestId: string;
  revision: number;
  status: AuthoringTaskStatus;
  title: string | null;
  lessonTitle: string | null;
  contentText: string | null;
  outline: Array<{
    title: string;
    lessons: Array<{ title: string; lessonType: string }>;
  }>;
};

export type SourceView = {
  id: string;
  taskId?: string | null;
  name: string;
  status: (typeof AUTHORING_SOURCE_STATUS)[keyof typeof AUTHORING_SOURCE_STATUS];
  selected: boolean;
  mediaType: string | null;
  readableSections: number | null;
  totalSections: number | null;
  warning: string | null;
  sections: Array<{
    id: string;
    kind: string;
    sequence: number;
    status: string;
    issue: string | null;
    pageNumber: number | null;
    label: string | null;
  }>;
};

export type SourceRefreshView = {
  refreshId: string | null;
  status: (typeof AUTHORING_SOURCE_REFRESH_STATUS)[keyof typeof AUTHORING_SOURCE_REFRESH_STATUS];
  oldSourceVersionId: string;
  replacementSourceVersionId: string;
  affectedTaskIds: string[];
  affectedProposalIds: string[];
  unmappedSectionIds: string[];
  suggestedSourcePolicy: SourcePolicy;
  sourcePolicy: SourcePolicy | null;
  coverageImpacts?: SourceRefreshCoverageImpact[];
  sequence: number;
};

export type SourceRefreshCoverageImpact = {
  taskId: string;
  lessonId: string | null;
  lessonTitle: string | null;
  sourceVersionIds: string[];
  requiredSectionIds: string[];
  mappedRequiredSectionIds: string[];
  mappedOutlineRequiredSectionIds: string[];
  mappedExcludedSectionIds: string[];
  unmappedSectionIds: string[];
  updateEligible: boolean;
};

export type QuestionView = {
  id: string;
  taskId: string;
  requestId: string | null;
  revision: number;
  prompt: string;
  choices: string[];
  capability: "web_search" | "deep_research" | null;
  reason: string | null;
  answer: string | null;
  answered: boolean;
};

export type ApplicationView = {
  id: string;
  status: (typeof AUTHORING_APPLICATION_STATUS)[keyof typeof AUTHORING_APPLICATION_STATUS];
  reason: string | null;
};

/** Sanitized durable author instruction; trusted course content is excluded from history. */
export type AuthoringRequestView = {
  id: string;
  requestId: string;
  instruction: string;
  createdAt: string;
  sourceVersionIds: string[];
};

export type OptimisticAuthoringRequest = AuthoringRequestView & {
  commandId: string;
  request: AuthoringRequest;
  status: typeof AUTHORING_TURN_STATUS.SENDING | typeof AUTHORING_TURN_STATUS.FAILED;
};

/** Sanitized assistant response emitted by an authoring route. */
export type AssistantMessageView = {
  id: string;
  requestId: string | null;
  taskId: string | null;
  route: string;
  message: string;
  /** Concise, model-authored actions for this generation turn. */
  planSteps?: string[];
  messageId?: string;
  partId?: string;
  partKind?: AuthoringPartKind;
  firstSequence?: number;
  partStatus?:
    | typeof AUTHORING_PART_STATUS.STREAMING
    | typeof AUTHORING_PART_STATUS.COMPLETED
    | typeof AUTHORING_PART_STATUS.FAILED;
  turnStatus?: AuthoringTurnStatus;
  toolCallId?: string | null;
  toolName?: string | null;
  toolStatus?:
    | typeof AUTHORING_TOOL_STATUS.STARTED
    | typeof AUTHORING_TOOL_STATUS.COMPLETED
    | typeof AUTHORING_TOOL_STATUS.FAILED
    | null;
  proposalId?: string | null;
  proposalRevision?: number | null;
  phase?: string | null;
};

export type ConversationMessageView =
  | { kind: "request"; value: AuthoringRequestView }
  | { kind: "assistant"; value: AssistantMessageView };

export type WorkspaceProjection = {
  requests: AuthoringRequestView[];
  assistantMessages: AssistantMessageView[];
  conversation: ConversationMessageView[];
  proposals: ProposalView[];
  previews: PreviewView[];
  sources: SourceView[];
  questions: QuestionView[];
  applications: ApplicationView[];
  unsupportedRecordCount: number;
  sourcePolicy: SourcePolicy | null;
  sourcePolicySequence?: number | null;
  sourceRefreshes: SourceRefreshView[];
  assetTasks: AssetTaskView[];
  readyAssetIds: string[];
};

export type CourseContext = {
  courseId: string;
  language: SupportedLanguages;
  title: string;
  description: string;
  baselineHash: string;
  fieldHashes: Record<string, string>;
  chapters: Array<{
    id: string;
    title: string;
    displayOrder: number | null;
    baselineHash: string;
    lessons: Array<{
      id: string;
      title: string;
      lessonType: string;
      displayOrder: number | null;
      baselineHash: string;
      assessmentAttemptCount?: number;
      description?: string;
      mentorConfiguration?: { baseLanguage: SupportedLanguages };
      blocks?: Array<{ id: string; html: string; baselineHash: string }>;
    }>;
  }>;
};

export type AuthoringConnectionState =
  (typeof AUTHORING_CONNECTION_STATE)[keyof typeof AUTHORING_CONNECTION_STATE];
