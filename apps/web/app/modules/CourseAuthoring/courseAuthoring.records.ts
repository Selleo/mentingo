/** Projects append-only authoring records into reviewable proposals, tasks, sources, and usage. */
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import type {
  ApplicationView,
  AssistantMessageView,
  AssetRequestView,
  AssetTaskView,
  AuthoringTask,
  AuthoringOperation,
  AuthoringRecord,
  AuthoringRequestView,
  CourseContext,
  CurriculumPreview,
  OutlineChapter,
  PreviewView,
  ProposalView,
  QuestionView,
  SourceView,
  SourceRefreshView,
  SourcePolicy,
  WorkspaceProjection,
} from "./courseAuthoring.types";

/** Narrows unknown record payload values before projection. */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads a non-empty string from untrusted durable payload data. */
const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** Reads finite numeric fields from untrusted durable payload data. */
const numberValue = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : null;

/** Excludes changes already present in the live course from a later combined review. */
export const excludeAppliedProposals = (
  proposals: ProposalView[],
  appliedProposalIds: ReadonlySet<string> = new Set(),
): ProposalView[] =>
  proposals.filter(
    (proposal) => proposal.decision !== "applied" && !appliedProposalIds.has(proposal.id),
  );

/** Reads a list of strings while dropping malformed entries. */
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const questionChoices = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (typeof item === "string") return [item];
        if (!isObject(item)) return [];
        const label = stringValue(item.label);
        return label ? [label] : [];
      })
    : [];

const assetPurposes = new Set<AssetRequestView["purpose"]>([
  "thumbnail",
  "lesson",
  "diagram",
  "avatar",
  "signature",
]);

/** Projects one generated visual request from a durable record. */
const parseAssetRequest = (value: unknown): AssetRequestView | null => {
  if (!isObject(value)) return null;
  const assetId = stringValue(value.assetId);
  const operationId = stringValue(value.operationId);
  const purpose = stringValue(value.purpose);
  const altText = stringValue(value.altText);
  const source = value.source;
  if (
    !assetId ||
    !operationId ||
    !altText ||
    !purpose ||
    !assetPurposes.has(purpose as AssetRequestView["purpose"]) ||
    typeof value.required !== "boolean" ||
    !isObject(source)
  ) {
    return null;
  }
  if (source.type === "generated") {
    const content = stringValue(source.content);
    const visualQuery = stringValue(source.visualQuery);
    return content && visualQuery
      ? {
          assetId,
          operationId,
          purpose: purpose as AssetRequestView["purpose"],
          required: value.required,
          altText,
          source: { type: "generated", content, visualQuery },
        }
      : null;
  }
  return null;
};

/** Projects all valid asset requests attached to a proposal. */
const parseAssetRequests = (value: unknown): AssetRequestView[] =>
  Array.isArray(value)
    ? value.flatMap((candidate) => {
        const request = parseAssetRequest(candidate);
        return request ? [request] : [];
      })
    : [];

/** Keeps only operation payloads that satisfy the local authoring projection contract. */
const parseOperations = (value: unknown): AuthoringOperation[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    const operationId = stringValue(candidate.operationId);
    const targetId = stringValue(candidate.targetId);
    const type = stringValue(candidate.type);
    const language = stringValue(candidate.language);
    const chapterId = stringValue(candidate.chapterId);
    const displayOrder = numberValue(candidate.displayOrder);
    if (!operationId || !targetId || !type) return [];

    return [
      {
        operationId,
        targetId,
        type,
        ...(language && ["en", "pl", "de", "lt", "cs", "es", "fr"].includes(language)
          ? { language: language as AuthoringOperation["language"] }
          : {}),
        ...(chapterId ? { chapterId } : {}),
        ...(displayOrder !== null && displayOrder >= 0 ? { displayOrder } : {}),
        dependencies: stringList(candidate.dependencies),
        payload: isObject(candidate.payload) ? candidate.payload : {},
      },
    ];
  });
};

const curriculumOperationTypes = new Set([
  "chapter.create",
  "chapter.update",
  "lesson.create",
  "lesson.update",
  "lesson.metadata.update",
]);

/** Builds the same read-only curriculum model for an explicit outline or typed operations. */
export const curriculumPreviewFromProposal = (
  proposal: ProposalView,
  context?: CourseContext | null,
): CurriculumPreview | null => {
  const chapters = new Map<string, CurriculumPreview["outline"][number]>(
    (proposal.outline ?? []).map((chapter) => [
      chapter.id,
      { ...chapter, lessons: [...chapter.lessons] },
    ]),
  );
  const contextChapters = new Map(
    (context?.chapters ?? []).map((chapter) => [chapter.id, chapter]),
  );
  const ensureChapter = (chapterId: string) => {
    const existing = chapters.get(chapterId);
    if (existing) return existing;
    const contextChapter = contextChapters.get(chapterId);
    if (!contextChapter) return null;
    const next = {
      id: contextChapter.id,
      title: contextChapter.title,
      ...(contextChapter.displayOrder !== null
        ? { displayOrder: contextChapter.displayOrder }
        : {}),
      lessons: [],
    };
    chapters.set(chapterId, next);
    return next;
  };

  proposal.operations.forEach((operation) => {
    if (!curriculumOperationTypes.has(operation.type)) return;
    if (operation.type === "chapter.create" || operation.type === "chapter.update") {
      const title = stringValue(operation.payload.title);
      const displayOrder = numberValue(operation.payload.displayOrder);
      if (!title) return;
      const current = chapters.get(operation.targetId) ?? ensureChapter(operation.targetId);
      const currentDisplayOrder =
        displayOrder !== null && displayOrder >= 0 ? displayOrder : current?.displayOrder;
      chapters.set(operation.targetId, {
        id: operation.targetId,
        title,
        ...(currentDisplayOrder !== undefined ? { displayOrder: currentDisplayOrder } : {}),
        lessons: current?.lessons ?? [],
      });
      return;
    }

    if (operation.type === "lesson.metadata.update") {
      const parent = [...contextChapters.values()].find((chapter) =>
        chapter.lessons.some((lesson) => lesson.id === operation.targetId),
      );
      const current = parent?.lessons.find((lesson) => lesson.id === operation.targetId);
      const chapter = parent ? ensureChapter(parent.id) : null;
      if (!chapter || !current) return;
      const lesson = {
        id: current.id,
        title: stringValue(operation.payload.title) || current.title,
        lessonType: current.lessonType,
        ...(current.displayOrder !== null ? { displayOrder: current.displayOrder } : {}),
      };
      const index = chapter.lessons.findIndex((item) => item.id === current.id);
      if (index < 0) chapter.lessons.push(lesson);
      else chapter.lessons[index] = lesson;
      return;
    }

    if (!operation.chapterId) return;
    const chapter = ensureChapter(operation.chapterId);
    const title = stringValue(operation.payload.title);
    const lessonType = stringValue(operation.payload.lessonType);
    if (!chapter || !title || !lessonType) return;
    const lesson = {
      id: operation.targetId,
      title,
      lessonType,
      ...(operation.displayOrder !== undefined ? { displayOrder: operation.displayOrder } : {}),
    };
    const existingIndex = chapter.lessons.findIndex((item) => item.id === lesson.id);
    if (existingIndex < 0) chapter.lessons.push(lesson);
    else chapter.lessons[existingIndex] = lesson;
  });

  const outline = [...chapters.values()]
    .map((chapter) => ({
      ...chapter,
      lessons: [...chapter.lessons].sort(
        (left, right) =>
          (left.displayOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.displayOrder ?? Number.MAX_SAFE_INTEGER),
      ),
    }))
    .sort(
      (left, right) =>
        (left.displayOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.displayOrder ?? Number.MAX_SAFE_INTEGER),
    );
  return {
    proposalId: proposal.id,
    status: proposal.decision === "accepted" ? "accepted" : "pending",
    operations: proposal.operations,
    outline,
  };
};

/** Combines one request's operations into the native curriculum preview without changing the course. */
export const curriculumPreviewFromProposals = (
  proposals: ProposalView[],
  context?: CourseContext | null,
  reviewGroupId?: string,
): CurriculumPreview | null => {
  const visibleProposals = proposals.filter(
    (proposal) => proposal.decision === "pending" || proposal.decision === "accepted",
  );
  if (visibleProposals.length === 0) return null;
  const firstProposal = visibleProposals[0];
  const latestOutline = [...visibleProposals]
    .reverse()
    .find((proposal) => proposal.outline?.length)?.outline;
  const preview = curriculumPreviewFromProposal(
    {
      ...firstProposal,
      id: reviewGroupId ?? firstProposal.id,
      operations: visibleProposals.flatMap((proposal) => proposal.operations),
      outline: latestOutline ?? null,
    },
    context,
  );
  if (!preview) return null;
  return {
    ...preview,
    proposalIds: visibleProposals.map((proposal) => proposal.id),
    ...(reviewGroupId ? { reviewGroupId } : {}),
  };
};

/** Projects a structured outline and drops malformed chapter or lesson entries. */
const parseOutline = (value: unknown): OutlineChapter[] | null => {
  if (!Array.isArray(value)) return null;

  const chapters = value.flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    const id = stringValue(candidate.id);
    const title = stringValue(candidate.title);
    if (!id || !title || !Array.isArray(candidate.lessons)) return [];

    const lessons = candidate.lessons.flatMap((lesson) => {
      if (!isObject(lesson)) return [];
      const lessonId = stringValue(lesson.id);
      const lessonTitle = stringValue(lesson.title);
      const lessonType = stringValue(lesson.lessonType);
      if (
        !lessonId ||
        !lessonTitle ||
        !lessonType ||
        !["content", "quiz", "ai_mentor"].includes(lessonType)
      ) {
        return [];
      }
      return [
        {
          id: lessonId,
          title: lessonTitle,
          lessonType: lessonType as "content" | "quiz" | "ai_mentor",
          objectives: stringList(lesson.objectives),
        },
      ];
    });

    return [{ id, title, lessons }];
  });

  return chapters.length > 0 ? chapters : null;
};

/** Indexes the latest decision record for each proposal or question target. */
const latestDecisions = (records: AuthoringRecord[]) => {
  const decisions = new Map<
    string,
    {
      sequence: number;
      accepted: boolean;
      qualityConcernsAccepted: boolean;
      status: string | null;
      acceptedCommandId: string | null;
    }
  >();
  records.forEach((record) => {
    if (record.kind !== "decision") return;
    const proposalId = stringValue(record.payload.proposalId);
    const sequence = numberValue(record.payload.sequence);
    if (!proposalId || sequence === null || typeof record.payload.accepted !== "boolean") return;
    const prior = decisions.get(proposalId);
    if (!prior || sequence >= prior.sequence) {
      decisions.set(proposalId, {
        sequence,
        accepted: record.payload.accepted,
        qualityConcernsAccepted: record.payload.qualityConcernsAccepted === true,
        status: stringValue(record.payload.status),
        acceptedCommandId:
          record.payload.accepted === true && stringValue(record.payload.status) !== "applied"
            ? proposalId
            : (prior?.acceptedCommandId ?? null),
      });
    }
  });
  return decisions;
};

const proposalDecision = (
  decision: { status: string | null; accepted: boolean } | undefined,
  snapshotStatus: string | null,
): ProposalView["decision"] => {
  if (decision) {
    if (decision.status === "applied") return "applied";
    if (decision.status === "superseded") return "superseded";
    return decision.accepted ? "accepted" : "rejected";
  }
  if (snapshotStatus === "applied") return "applied";
  if (snapshotStatus === "accepted") return "accepted";
  if (snapshotStatus === "superseded") return "superseded";
  // Both outcomes are terminal declines; the request card presents an all-declined set as Discarded.
  if (snapshotStatus === "rejected" || snapshotStatus === "discarded") return "rejected";
  return "pending";
};

/** Projects a proposal record together with its latest decision state. */
const parseProposal = (
  record: AuthoringRecord,
  decisions: ReturnType<typeof latestDecisions>,
): ProposalView | null => {
  const revision = numberValue(record.payload.revision);
  if (revision === null) return null;
  const proposalId = stringValue(record.payload.id) ?? record.id;
  const decision = decisions.get(proposalId);
  const snapshotStatus = stringValue(record.payload.status);
  return {
    id: proposalId,
    revision,
    taskId: stringValue(record.payload.taskId),
    summary:
      stringValue(record.payload.title) ??
      stringValue(record.payload.summary) ??
      "Proposed course change",
    rationale: stringValue(record.payload.rationale) ?? "",
    warnings: [
      ...stringList(record.payload.warnings),
      ...stringList(record.payload.educationalConcerns),
    ],
    blockedQuality: record.payload.blockedQuality === true,
    qualityConcernsAccepted: decision?.qualityConcernsAccepted ?? false,
    evidenceCount: Array.isArray(record.payload.evidence) ? record.payload.evidence.length : 0,
    operations: parseOperations(record.payload.operations),
    outline: parseOutline(record.payload.outline),
    decision: proposalDecision(decision, snapshotStatus),
    acceptedCommandId: decision?.acceptedCommandId ?? null,
    parentProposalId: stringValue(record.payload.parentProposalId),
    manual: record.payload.manual === true,
    protectedEdits: stringList(record.payload.protectedEdits),
    assetRequests: parseAssetRequests(record.payload.assetRequests),
    assetIds: stringList(record.payload.assetIds),
  };
};

const activePreviewStatuses = new Set([
  "queued",
  "running",
  "waiting_author",
  "waiting_dependencies",
  "paused",
]);

/** Selects the latest authoritative outline without falling back to stale proposals or streams. */
export const latestCurriculumPreview = (
  proposals: ProposalView[],
  previews: PreviewView[],
  appliedProposalIds: ReadonlySet<string> = new Set(),
): CurriculumPreview | null => {
  const latestProposal = proposals.at(-1);
  if (latestProposal) {
    if (
      latestProposal.decision === "rejected" ||
      latestProposal.decision === "applied" ||
      appliedProposalIds.has(latestProposal.id)
    ) {
      return null;
    }
    return curriculumPreviewFromProposal(latestProposal);
  }

  const latestPreview = previews.at(-1);
  if (!latestPreview || !activePreviewStatuses.has(latestPreview.status)) return null;
  if (latestPreview.outline.length === 0) return null;

  return {
    proposalId: latestPreview.taskId,
    status: "streaming",
    outline: latestPreview.outline.map((chapter, chapterIndex) => ({
      id: `${latestPreview.taskId}:chapter:${chapterIndex}`,
      title: chapter.title,
      lessons: chapter.lessons.map((lesson, lessonIndex) => ({
        id: `${latestPreview.taskId}:chapter:${chapterIndex}:lesson:${lessonIndex}`,
        title: lesson.title,
        lessonType: lesson.lessonType,
      })),
    })),
  };
};

/** Projects a provisional preview while limiting rendered content to plain text. */
const parsePreview = (record: AuthoringRecord, tasks: AuthoringTask[]): PreviewView | null => {
  if (record.payload.provisional !== true) return null;
  const taskId = stringValue(record.payload.taskId);
  const requestId = stringValue(record.payload.requestId);
  const revision = numberValue(record.payload.revision);
  if (!taskId || !requestId || revision === null) return null;

  const outline = Array.isArray(record.payload.outline)
    ? record.payload.outline.flatMap((chapter) => {
        if (!isObject(chapter)) return [];
        const title = stringValue(chapter.title);
        if (!title || !Array.isArray(chapter.lessons)) return [];
        const lessons = chapter.lessons.flatMap((lesson) => {
          if (!isObject(lesson)) return [];
          const lessonTitle = stringValue(lesson.title);
          const lessonType = stringValue(lesson.lessonType);
          return lessonTitle && lessonType ? [{ title: lessonTitle, lessonType }] : [];
        });
        return [{ title, lessons }];
      })
    : [];
  const contentHtml = stringValue(record.payload.contentHtml);
  const contentText = contentHtml
    ? stripHtmlTags(contentHtml).replace(/\s+/g, " ").trim().slice(0, 600) || null
    : null;

  return {
    id: record.id,
    taskId,
    requestId,
    revision,
    status: tasks.find((task) => task.taskId === taskId)?.status ?? "unknown",
    title: stringValue(record.payload.title),
    lessonTitle: stringValue(record.payload.lessonTitle),
    contentText,
    outline,
  };
};

/** Projects source metadata and section labels for selection and refresh review. */
const parseSource = (record: AuthoringRecord): SourceView => {
  const status = stringValue(record.payload.status);
  const sections = Array.isArray(record.payload.sections)
    ? record.payload.sections.flatMap((candidate) => {
        if (!isObject(candidate)) return [];
        const id = stringValue(candidate.id);
        const kind = stringValue(candidate.kind);
        const sequence = numberValue(candidate.sequence);
        const sectionStatus = stringValue(candidate.status);
        if (!id || !kind || sequence === null || !sectionStatus) return [];
        return [
          {
            id,
            kind,
            sequence,
            status: sectionStatus,
            issue: stringValue(candidate.issue),
            pageNumber: numberValue(candidate.pageNumber),
            label: stringValue(candidate.label),
          },
        ];
      })
    : [];
  const readableSections = sections.filter(
    (section) => section.status === "ready" || section.status === "partial",
  ).length;
  const knownStatus = ["queued", "processing", "ready", "partial", "failed"].includes(status ?? "")
    ? (status as SourceView["status"])
    : "unknown";
  const completedStatus =
    knownStatus === "partial" ? (readableSections > 0 ? "ready" : "failed") : knownStatus;
  return {
    id: stringValue(record.payload.sourceVersionId) ?? record.id,
    taskId: stringValue(record.payload.taskId),
    name:
      stringValue(record.payload.filename) ?? stringValue(record.payload.name) ?? "Source document",
    status: completedStatus,
    selected: record.payload.selected === true,
    mediaType: stringValue(record.payload.mediaType),
    readableSections,
    totalSections: sections.length,
    warning: stringValue(record.payload.warning) ?? stringList(record.payload.warnings)[0] ?? null,
    sections,
  };
};

/** Projects one assistant response without inventing text for incomplete records. */
const parseAssistantMessage = (record: AuthoringRecord): AssistantMessageView | null => {
  const route = stringValue(record.payload.route);
  const message = stringValue(record.payload.message);
  if (!route || !message) return null;

  return {
    id: record.id,
    requestId: stringValue(record.payload.requestId),
    taskId: stringValue(record.payload.taskId),
    route,
    message,
    planSteps: stringList(record.payload.planSteps),
    partId: stringValue(record.payload.partId) ?? undefined,
  };
};

/** Projects a normal author question; asset tasks remain a separate action path. */
const parseQuestion = (
  record: AuthoringRecord,
  tasks: AuthoringTask[],
  answersByTaskRevision: Map<string, string>,
): QuestionView | null => {
  const taskId = stringValue(record.payload.taskId);
  const prompt = stringValue(record.payload.question) ?? stringValue(record.payload.prompt);
  const revision = numberValue(record.payload.revision) ?? numberValue(record.payload.controlEpoch);
  const durableAnswer =
    taskId && revision !== null ? answersByTaskRevision.get(`${taskId}:${revision}`) : undefined;
  const answer = durableAnswer ?? stringValue(record.payload.answer);
  const status = stringValue(record.payload.status);
  if (!taskId || !prompt || revision === null || record.payload.action === "asset.retry_submission")
    return null;
  return {
    id: record.id,
    taskId,
    requestId:
      stringValue(record.payload.requestId) ??
      tasks.find((task) => task.taskId === taskId)?.requestId ??
      null,
    revision,
    prompt,
    choices: questionChoices(record.payload.choices),
    capability: record.payload.capability === "web_search" ? "web_search" : null,
    reason: stringValue(record.payload.reason),
    answer,
    answered:
      record.payload.answered === true ||
      answer !== null ||
      status === "answered" ||
      status === "resolved",
  };
};

/** Projects an asset task and its latest action question without treating it as a quiz answer. */
const parseAssetTask = (
  record: AuthoringRecord,
  tasks: AuthoringTask[],
  questionsByTaskId: Map<string, AuthoringRecord>,
  readyAssetIds: Set<string>,
): AssetTaskView | null => {
  if (record.kind !== "asset_task") return null;
  const taskId = stringValue(record.payload.taskId) ?? record.id.split(":")[0] ?? null;
  const request = parseAssetRequest(record.payload.request);
  if (!taskId || !request) return null;
  const question = questionsByTaskId.get(taskId);
  const action = question?.payload.action;
  const task = tasks.find((item) => item.taskId === taskId);
  return {
    taskId,
    parentTaskId: stringValue(record.payload.parentTaskId),
    request,
    status: task?.status ?? "unknown",
    revision: question
      ? numberValue(question.payload.revision)
      : numberValue(record.payload.revision),
    question: question ? stringValue(question.payload.question) : null,
    action: action === "asset.retry_submission" ? action : null,
    ready: readyAssetIds.has(request.assetId),
  };
};

/** Projects the latest application status and receipt metadata. */
const parseApplication = (record: AuthoringRecord): ApplicationView => {
  const status = stringValue(record.payload.status);
  return {
    id: record.id,
    status: ["applied", "conflict", "failed"].includes(status ?? "")
      ? (status as ApplicationView["status"])
      : "pending",
    reason: stringValue(record.payload.reason),
  };
};

/** Validates a persisted source policy before exposing it to controls. */
const parseSourcePolicy = (payload: Record<string, unknown>): SourcePolicy | null => {
  const researchDepth = stringValue(payload.researchDepth);
  if (researchDepth !== "standard" && researchDepth !== "deep") return null;
  if (
    typeof payload.webEnabled !== "boolean" ||
    typeof payload.generalKnowledgeEnabled !== "boolean"
  ) {
    return null;
  }
  const requiredSectionIds = stringList(payload.requiredSectionIds);
  const excludedSectionIds = stringList(payload.excludedSectionIds);
  if (requiredSectionIds.some((id) => excludedSectionIds.includes(id))) return null;
  return {
    sourceVersionIds: stringList(payload.sourceVersionIds),
    webEnabled: payload.webEnabled,
    generalKnowledgeEnabled: payload.generalKnowledgeEnabled,
    researchDepth,
    requiredSectionIds,
    excludedSectionIds,
  };
};

/** Projects replacement-source impact and mapping state from a durable report. */
const parseSourceRefresh = (record: AuthoringRecord): SourceRefreshView | null => {
  const status = record.payload.status;
  if (status !== "refreshed" && status !== "needs_mapping") return null;
  const oldSourceVersionId = stringValue(record.payload.oldSourceVersionId);
  const replacementSourceVersionId = stringValue(record.payload.replacementSourceVersionId);
  const suggestedSourcePolicy = isObject(record.payload.suggestedSourcePolicy)
    ? parseSourcePolicy(record.payload.suggestedSourcePolicy)
    : null;
  const sourcePolicy = isObject(record.payload.sourcePolicy)
    ? parseSourcePolicy(record.payload.sourcePolicy)
    : null;
  if (!oldSourceVersionId || !replacementSourceVersionId || !suggestedSourcePolicy) return null;
  const coverageImpacts = Array.isArray(record.payload.coverageImpacts)
    ? record.payload.coverageImpacts.flatMap((value) => {
        if (!isObject(value)) return [];
        const taskId = stringValue(value.taskId);
        if (!taskId || typeof value.updateEligible !== "boolean") return [];
        return [
          {
            taskId,
            lessonId: stringValue(value.lessonId),
            lessonTitle: stringValue(value.lessonTitle),
            sourceVersionIds: stringList(value.sourceVersionIds),
            requiredSectionIds: stringList(value.requiredSectionIds),
            mappedRequiredSectionIds: stringList(value.mappedRequiredSectionIds),
            mappedOutlineRequiredSectionIds: stringList(value.mappedOutlineRequiredSectionIds),
            mappedExcludedSectionIds: stringList(value.mappedExcludedSectionIds),
            unmappedSectionIds: stringList(value.unmappedSectionIds),
            updateEligible: value.updateEligible,
          },
        ];
      })
    : [];
  return {
    refreshId: stringValue(record.payload.refreshId),
    status,
    oldSourceVersionId,
    replacementSourceVersionId,
    affectedTaskIds: stringList(record.payload.affectedTaskIds),
    affectedProposalIds: stringList(record.payload.affectedProposalIds),
    unmappedSectionIds: stringList(record.payload.unmappedSectionIds),
    suggestedSourcePolicy,
    sourcePolicy,
    coverageImpacts,
    sequence: numberValue(record.payload.sequence) ?? -1,
  };
};

/** Reads display-only request history, excluding any extra stored context or source payload. */
const parseRequest = (record: AuthoringRecord): AuthoringRequestView | null => {
  const requestId = stringValue(record.payload.requestId);
  const instruction = stringValue(record.payload.instruction);
  const createdAt = stringValue(record.payload.createdAt);
  if (!requestId || !instruction || !createdAt || !Number.isFinite(Date.parse(createdAt)))
    return null;
  return {
    id: record.id,
    requestId,
    instruction,
    createdAt,
    sourceVersionIds: stringList(record.payload.attachedSourceVersionIds),
  };
};

/** Reduces append-only records into the current review workspace projection. */
export const projectWorkspaceRecords = (
  records: AuthoringRecord[],
  tasks: AuthoringTask[] = [],
): WorkspaceProjection => {
  const decisions = latestDecisions(records);
  const projection: WorkspaceProjection = {
    requests: [],
    assistantMessages: [],
    conversation: [],
    proposals: [],
    previews: [],
    sources: [],
    questions: [],
    applications: [],
    unsupportedRecordCount: 0,
    sourcePolicy: null,
    sourceRefreshes: [],
    assetTasks: [],
    readyAssetIds: [],
  };

  const readyAssetIds = new Set(
    records.flatMap((record) => {
      if (record.kind !== "asset" || record.payload.status !== "ready") return [];
      const manifest = isObject(record.payload.manifest) ? record.payload.manifest : null;
      const assetId =
        stringValue(record.payload.assetId) ??
        (manifest ? stringValue(manifest.assetId) : null) ??
        record.id.split(":")[0];
      return assetId ? [assetId] : [];
    }),
  );
  const questionsByTaskId = new Map<string, AuthoringRecord>();
  const answersByTaskRevision = new Map<string, string>();
  records.forEach((record) => {
    if (record.kind === "question_answer") {
      const taskId = stringValue(record.payload.taskId);
      const revision = numberValue(record.payload.revision);
      const answer = stringValue(record.payload.answer);
      if (taskId && revision !== null && answer) {
        answersByTaskRevision.set(`${taskId}:${revision}`, answer);
      }
    }
    if (record.kind !== "question") return;
    const taskId = stringValue(record.payload.taskId);
    if (!taskId) return;
    const prior = questionsByTaskId.get(taskId);
    const revision = numberValue(record.payload.revision) ?? -1;
    const priorRevision = prior ? (numberValue(prior.payload.revision) ?? -1) : -1;
    if (!prior || revision >= priorRevision) questionsByTaskId.set(taskId, record);
  });

  const selection = records
    .filter((record) => record.kind === "source_selection")
    .map((record) => ({ record, sequence: numberValue(record.payload.sequence) ?? -1 }))
    .sort((left, right) => right.sequence - left.sequence)[0]?.record;
  if (selection) {
    projection.sourcePolicy = parseSourcePolicy(selection.payload);
    if (!projection.sourcePolicy) projection.unsupportedRecordCount += 1;
  }

  records.forEach((record) => {
    if (record.kind === "request") {
      const request = parseRequest(record);
      if (request) {
        projection.requests.push(request);
        projection.conversation.push({ kind: "request", value: request });
      } else projection.unsupportedRecordCount += 1;
      return;
    }
    if (record.kind === "assistant") {
      const message = parseAssistantMessage(record);
      if (message) {
        projection.assistantMessages.push(message);
        projection.conversation.push({ kind: "assistant", value: message });
      } else projection.unsupportedRecordCount += 1;
      return;
    }
    if (record.kind === "proposal") {
      const proposal = parseProposal(record, decisions);
      if (proposal) projection.proposals.push(proposal);
      else projection.unsupportedRecordCount += 1;
      return;
    }
    if (record.kind === "preview") {
      const preview = parsePreview(record, tasks);
      if (preview) {
        const priorIndex = projection.previews.findIndex((item) => item.taskId === preview.taskId);
        if (priorIndex < 0) projection.previews.push(preview);
        else if (preview.revision >= projection.previews[priorIndex].revision) {
          projection.previews[priorIndex] = preview;
        }
      } else projection.unsupportedRecordCount += 1;
      return;
    }
    if (record.kind === "source") {
      projection.sources.push(parseSource(record));
      return;
    }
    if (record.kind === "source_refresh") {
      const sourceRefresh = parseSourceRefresh(record);
      if (sourceRefresh) projection.sourceRefreshes.push(sourceRefresh);
      else projection.unsupportedRecordCount += 1;
      return;
    }
    if (record.kind === "question") {
      const question = parseQuestion(record, tasks, answersByTaskRevision);
      if (!question) {
        projection.unsupportedRecordCount += 1;
        return;
      }

      if (question.capability === "web_search" && !question.answered) {
        // Do not offer or replay controls for an interrupt after its task has
        // already left the author-waiting state; there is nothing left to resume.
        const task = tasks.find((candidate) => candidate.taskId === question.taskId);
        if (task && task.status !== "waiting_author") return;

        // Source policy is the durable authorization record. A prior grant resolves
        // stale permission prompts even when the workflow's question event lagged it.
        if (projection.sourcePolicy?.webEnabled) {
          projection.questions.push({ ...question, answer: "allow", answered: true });
          return;
        }
      }

      projection.questions.push(question);
      return;
    }
    if (record.kind === "question_answer") {
      const taskId = stringValue(record.payload.taskId);
      const revision = numberValue(record.payload.revision);
      const answer = stringValue(record.payload.answer);
      if (!taskId || revision === null || !answer) projection.unsupportedRecordCount += 1;
      return;
    }
    if (record.kind === "asset_task") {
      const assetTask = parseAssetTask(record, tasks, questionsByTaskId, readyAssetIds);
      if (assetTask) projection.assetTasks.push(assetTask);
      else projection.unsupportedRecordCount += 1;
      return;
    }
    if (record.kind === "asset") {
      return;
    }
    if (
      [
        "assistant.delta",
        "detailed_plan",
        "model_response",
        "source_version",
        "web_evidence",
      ].includes(record.kind)
    ) {
      return;
    }
    if (record.kind === "application") {
      projection.applications.push(parseApplication(record));
      return;
    }
    // Durable execution records are not necessarily conversation content. A new
    // internal record kind must not make the author believe their chat is stale.
  });

  projection.requests.sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id),
  );

  // Session policy can keep sources available after their upload. Show each source chip only on
  // its first durable request, where the file was originally attached.
  const attachedSourceIds = new Set<string>();
  const requestById = new Map<string, AuthoringRequestView>();
  projection.requests = projection.requests.map((request) => {
    const sourceVersionIds = request.sourceVersionIds.filter((sourceVersionId) => {
      if (attachedSourceIds.has(sourceVersionId)) return false;
      attachedSourceIds.add(sourceVersionId);
      return true;
    });
    const ownedRequest = { ...request, sourceVersionIds };
    requestById.set(request.requestId, ownedRequest);
    return ownedRequest;
  });
  projection.conversation = projection.conversation.map((entry) =>
    entry.kind === "request"
      ? { kind: "request", value: requestById.get(entry.value.requestId) ?? entry.value }
      : entry,
  );

  if (projection.sourcePolicy) {
    projection.sources = projection.sources.map((source) => ({
      ...source,
      selected: projection.sourcePolicy?.sourceVersionIds.includes(source.id) ?? false,
    }));
  }
  const completedTaskIds = new Set(
    projection.proposals.flatMap((proposal) => (proposal.taskId ? [proposal.taskId] : [])),
  );
  projection.previews = projection.previews.filter(
    (preview) => !completedTaskIds.has(preview.taskId),
  );
  projection.sourceRefreshes.sort((left, right) => right.sequence - left.sequence);
  projection.readyAssetIds = [...readyAssetIds];

  return projection;
};

/** Returns a readable operation summary for proposal cards and previews. */
export const operationLabel = (operation: AuthoringOperation): string => {
  const title = stringValue(operation.payload.title);
  if (title) return title;
  const html = stringValue(operation.payload.html);
  if (html)
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 96);
  return operation.type.replaceAll(".", " ");
};

/** Computes selected proposal dependencies before allowing an atomic apply. */
export const proposalDependencyClosure = (
  selectedProposalIds: string[],
  proposals: ProposalView[],
): { ids: string[]; missingDependencies: string[] } => {
  const selected = proposals.filter((proposal) => selectedProposalIds.includes(proposal.id));
  const operationIds = new Set(
    selected.flatMap((proposal) => proposal.operations.map((item) => item.operationId)),
  );
  const missingDependencies = Array.from(
    new Set(
      selected.flatMap((proposal) =>
        proposal.operations.flatMap((operation) =>
          operation.dependencies.filter((dependency) => !operationIds.has(dependency)),
        ),
      ),
    ),
  );
  return { ids: selected.map((proposal) => proposal.id), missingDependencies };
};
