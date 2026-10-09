/**
 * Host-independent session controller for course generation and reviewed application.
 * Receives course/language explicitly so the same durable interaction can run in
 * a drawer, route or later inline host. Unmounting does not send a stop command.
 */
import { Link } from "@remix-run/react";
import { isAxiosError } from "axios";
import { ArrowLeft, CloudOff, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useApplyCourseAuthoringProposals } from "~/api/mutations/useApplyCourseAuthoringProposals";
import { useUploadCourseAuthoringSource } from "~/api/mutations/useUploadCourseAuthoringSource";
import { useCourseAuthoringApplicationQuery } from "~/api/queries/useCourseAuthoringApplicationQuery";
import { authoringSessionKey } from "~/api/queries/useCourseAuthoringSessionQuery";
import { useCourseAuthoringTurnHistoryQuery } from "~/api/queries/useCourseAuthoringTurnHistoryQuery";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateCourseCurriculumData } from "~/api/utils/invalidateCourseCurriculumData";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";

import { COURSE_AUTHORING_HANDLES } from "../../../e2e/data/curriculum/handles";

import {
  activeAssistantRequestIds,
  activeChatRequestId,
  projectAuthoringTimeline,
} from "./authoringConversation";
import { requestGenerationPending } from "./authoringReviewReadiness";
import { isUnavailableAuthoringSession } from "./authoringSessionRecovery";
import { authoringTaskDisplayLabels } from "./authoringTaskLabels";
import { attachAuthoringWorkProgress } from "./authoringWorkProgress";
import { AuthoringActivityRail } from "./components/AuthoringActivityRail";
import { AuthoringAssistantMessages } from "./components/AuthoringAssistantMessages";
import { AuthoringBriefPanel, freshSessionPolicy } from "./components/AuthoringBriefPanel";
import { CourseGenerationInteraction } from "./components/CourseGenerationInteraction";
import { ProposalGroup } from "./components/ProposalGroupCard";
import { ProposalReview } from "./components/ProposalReview";
import {
  curriculumPreviewFromProposal,
  curriculumPreviewFromProposals,
  excludeAppliedProposals,
  latestCurriculumPreview,
  proposalDependencyClosure,
  projectWorkspaceRecords,
} from "./courseAuthoring.records";
import { useCourseAuthoringChat } from "./hooks/useCourseAuthoringChat";
import { useCourseAuthoringSession } from "./hooks/useCourseAuthoringSession";
import { useCourseAuthoringSocket } from "./hooks/useCourseAuthoringSocket";
import { targetedMentorOperationIds } from "./mentorReferenceFiles";
import { toReviewProposals } from "./review/reviewProposals";

import type { AuthoringChatMessage } from "./authoringChatTransport";
import type { AuthoringTimelineItem } from "./authoringConversation";
import type { ProposalApplicationStatus } from "./components/ProposalReview";
import type {
  AuthoringCommand,
  AuthoringEvent,
  AuthoringSession,
  AuthoringTask,
  AssetTaskView,
  CurriculumPreview,
  CurriculumPreviewActions,
  ProposalView,
  PreviewView,
  QuestionView,
  ProposalRegeneration,
  SourcePolicy,
} from "./courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";

/** Displays a recoverable session error without losing the route context. */
const ErrorState = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center">
      <CloudOff className="size-6 text-neutral-500" />
      <h1 className="mt-4 text-xl font-semibold">{t("courseAuthoring.conversation.errorTitle")}</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-600">
        {t("courseAuthoring.conversation.errorBody")}
      </p>
      <Button type="button" className="mt-5 gap-2" onClick={onRetry}>
        <RotateCcw className="size-4" /> {t("courseAuthoring.conversation.retry")}
      </Button>
    </div>
  );
};

/** Mirrors the single-column interaction while its saved session loads. */
const LoadingState = () => (
  <div className="mx-auto w-full max-w-3xl space-y-6 pt-16">
    <Skeleton className="h-8 w-2/3" />
    <Skeleton className="h-5 w-4/5" />
    <Skeleton className="h-40 rounded-xl" />
  </div>
);

type TrackedApplication = {
  exportId: string;
  proposalIds: string[];
  confirmed?: boolean;
};

/** Keeps the current export cursor across a page reload while Core owns the durable job and receipt. */
const applicationStorageKey = (courseId: string, sessionId: string) =>
  `course-authoring-application:${courseId}:${sessionId}`;

/** Ignores malformed browser state; the status endpoint remains the authority. */
const readTrackedApplication = (courseId: string, sessionId: string): TrackedApplication | null => {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(applicationStorageKey(courseId, sessionId)) ?? "null",
    );
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.exportId !== "string" || !Array.isArray(candidate.proposalIds))
      return null;
    if (!candidate.proposalIds.every((id) => typeof id === "string")) return null;
    return {
      exportId: candidate.exportId,
      proposalIds: candidate.proposalIds as string[],
      confirmed: candidate.confirmed === true,
    };
  } catch {
    return null;
  }
};

/** Saves only the non-secret export cursor needed to resume status polling. */
const writeTrackedApplication = (
  courseId: string,
  sessionId: string,
  application: TrackedApplication | null,
) => {
  if (typeof window === "undefined") return;
  const key = applicationStorageKey(courseId, sessionId);
  if (application) window.sessionStorage.setItem(key, JSON.stringify(application));
  else window.sessionStorage.removeItem(key);
};

/** Chooses a localized phase label from the durable task kind and lifecycle state. */
const canonicalToolTaskState = (messages: AuthoringChatMessage[]) => {
  const taskIdsByRequest = new Map<string, Set<string>>();
  const activeRequestIds = new Set<string>();

  messages
    .filter((message) => message.role === "assistant")
    .forEach((message) => {
      const requestId = message.metadata?.requestId;
      if (!requestId) return;
      message.parts.forEach((part) => {
        if (part.type !== "data-authoringPart" || part.data.partKind !== "tool") return;
        if (part.data.taskId) {
          const taskIds = taskIdsByRequest.get(requestId) ?? new Set<string>();
          taskIds.add(part.data.taskId);
          taskIdsByRequest.set(requestId, taskIds);
        }
        if (part.data.status === "streaming" || part.data.tool?.status === "started") {
          activeRequestIds.add(requestId);
        }
      });
    });

  return { taskIdsByRequest, activeRequestIds };
};

const isDuplicateResearchTask = (task: AuthoringTask, toolTaskIds: Set<string>) => {
  const phaseOrKind = task.phase ?? task.kind;
  const isResearchTask =
    phaseOrKind === "research" ||
    phaseOrKind === "source" ||
    phaseOrKind === "source_refresh" ||
    phaseOrKind === "source_selection";
  const preservesRecoveryControls = ["failed", "stopped", "superseded"].includes(task.status);
  return isResearchTask && toolTaskIds.has(task.taskId) && !preservesRecoveryControls;
};

/** Composes the authoring panels and routes commands through session hooks. */
export const CourseGenerationSession = ({
  courseId: id,
  language,
  sessionId,
  embedded = false,
  onPreviewInCurriculum,
  onPreviewProposalInCurriculum,
  onCurriculumPreviewChange,
  onSessionUnavailable,
}: {
  courseId: string;
  language: SupportedLanguages;
  sessionId: string;
  embedded?: boolean;
  onPreviewInCurriculum?: (preview: PreviewView) => void;
  onPreviewProposalInCurriculum?: (
    preview: CurriculumPreview,
    actions: CurriculumPreviewActions,
  ) => void;
  onCurriculumPreviewChange?: (preview: CurriculumPreview | null) => void;
  onSessionUnavailable?: (sessionId: string) => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [applyState, setApplyState] = useState<
    "idle" | "preparing" | "synchronizing" | "applying" | "applied" | "conflict" | "failed"
  >("idle");
  const [trackedApplication] = useState(() => readTrackedApplication(id, sessionId));
  const [exportId, setExportId] = useState<string | null>(
    trackedApplication?.confirmed ? null : (trackedApplication?.exportId ?? null),
  );
  const [pendingApplyRequest, setPendingApplyRequest] = useState<{
    proposalIds: string[];
    acknowledgeAssessmentChanges: boolean;
    omitOptionalAssetIds: string[];
    commandId: string;
  } | null>(null);
  const [omittedOptionalAssetIds, setOmittedOptionalAssetIds] = useState<string[]>([]);
  const omittedOptionalAssetIdsRef = useRef<string[]>([]);
  useEffect(() => {
    omittedOptionalAssetIdsRef.current = omittedOptionalAssetIds;
  }, [omittedOptionalAssetIds]);
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
  const [appliedProposalIds, setAppliedProposalIds] = useState<Set<string>>(
    () => new Set(trackedApplication?.confirmed ? trackedApplication.proposalIds : []),
  );
  const lastSubmittedApplyProposalIdsRef = useRef<string[]>(trackedApplication?.proposalIds ?? []);
  const notifiedApplicationRef = useRef<string | null>(null);
  const activeApplicationRef = useRef<string | null>(null);
  const refreshedAppliedExportsRef = useRef(new Set<string>());
  const latestSourcePolicyRef = useRef<SourcePolicy | null>(null);
  const sourcePolicySessionRef = useRef<string | null>(null);
  const authoringSessionRef = useRef<AuthoringSession | undefined>(undefined);
  const authoringEventListenersRef = useRef(
    new Set<(event: import("./courseAuthoring.types").AuthoringEvent) => void>(),
  );
  const { sessionQuery, contextQuery, commandMutation, refetchSnapshot } =
    useCourseAuthoringSession(id, language, sessionId);
  const refetchAuthoringContext = contextQuery.refetch;
  const refreshAfterConfirmedApply = useCallback(
    async (applicationExportId: string) => {
      if (refreshedAppliedExportsRef.current.has(applicationExportId)) return;
      refreshedAppliedExportsRef.current.add(applicationExportId);
      try {
        await invalidateCourseCurriculumData();
        await refetchAuthoringContext({ throwOnError: true });
        await refetchSnapshot();
      } catch (error) {
        refreshedAppliedExportsRef.current.delete(applicationExportId);
        throw error;
      }
    },
    [refetchAuthoringContext, refetchSnapshot],
  );
  const session = sessionQuery.data;
  const historyQuery = useCourseAuthoringTurnHistoryQuery(
    id,
    sessionId,
    session?.nextBeforeRequestId,
  );
  const olderPages = historyQuery.data?.pages;
  const visibleRecords = useMemo(() => {
    const records = [
      ...(session?.records ?? []),
      ...(olderPages?.flatMap((page) => page.records) ?? []),
    ];
    return [...new Map(records.map((record) => [record.id, record])).values()];
  }, [session?.records, olderPages]);
  const visibleTurns = useMemo(() => {
    const turns = [...(session?.turns ?? []), ...(olderPages?.flatMap((page) => page.turns) ?? [])];
    return [...new Map(turns.map((turn) => [turn.requestId, turn])).values()].sort(
      (left, right) => left.firstSequence - right.firstSequence,
    );
  }, [session?.turns, olderPages]);
  const context = contextQuery.data;
  const unavailableSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionQuery.isError || !isUnavailableAuthoringSession(sessionQuery.error)) return;
    if (unavailableSessionRef.current === sessionId) return;
    unavailableSessionRef.current = sessionId;
    onSessionUnavailable?.(sessionId);
  }, [onSessionUnavailable, sessionId, sessionQuery.error, sessionQuery.isError]);
  const targetLabelById = useMemo(() => {
    if (!context) return {};
    const labels: Record<string, string> = { [context.courseId]: context.title };
    context.chapters.forEach((chapter, chapterIndex) => {
      labels[chapter.id] = t("courseAuthoring.review.targetChapter", {
        number: chapterIndex + 1,
        title: chapter.title,
      });
      chapter.lessons.forEach((lesson, lessonIndex) => {
        const lessonLabel = t("courseAuthoring.review.targetLesson", {
          chapter: chapterIndex + 1,
          lesson: lessonIndex + 1,
          title: lesson.title,
        });
        labels[lesson.id] = lessonLabel;
        lesson.blocks?.forEach((block, blockIndex) => {
          labels[block.id] = t("courseAuthoring.review.targetBlock", {
            lesson: lessonLabel,
            number: blockIndex + 1,
          });
        });
      });
    });
    return labels;
  }, [context, t]);
  const applicationStatusByProposalId = useMemo(() => {
    const status = match(applyState)
      .with("synchronizing", () => "synchronizing" as const)
      .with("applying", () => "applying" as const)
      .with("applied", () => "applied" as const)
      .with("failed", () => "failed" as const)
      .with("conflict", () => "conflict" as const)
      .otherwise(() => null);
    const entries: Array<readonly [string, ProposalApplicationStatus]> = [
      ...appliedProposalIds,
    ].map((proposalId) => [proposalId, "applied"]);
    if (status && status !== "applied") {
      lastSubmittedApplyProposalIdsRef.current.forEach((proposalId) => {
        if (!appliedProposalIds.has(proposalId)) entries.push([proposalId, status]);
      });
    }
    return Object.fromEntries(entries);
  }, [appliedProposalIds, applyState]);

  useEffect(() => {
    authoringSessionRef.current = session;
  }, [session]);

  const subscribeAuthoringEvents = useCallback((listener: (event: AuthoringEvent) => void) => {
    authoringEventListenersRef.current.add(listener);
    return () => authoringEventListenersRef.current.delete(listener);
  }, []);

  /** Accepts a websocket snapshot through the monotonic query projection. */
  const handleSnapshot = useCallback(
    (snapshot: AuthoringSession) => {
      authoringSessionRef.current = snapshot;
      queryClient.setQueryData<AuthoringSession>(authoringSessionKey(id, sessionId), (current) =>
        !current || snapshot.snapshotSequence >= current.snapshotSequence ? snapshot : current,
      );
    },
    [id, sessionId],
  );
  const handleEvent = useCallback(
    (eventSession: AuthoringSession, event: AuthoringEvent) => {
      authoringSessionRef.current = eventSession;
      queryClient.setQueryData<AuthoringSession>(authoringSessionKey(id, sessionId), (current) =>
        !current || eventSession.snapshotSequence >= current.snapshotSequence
          ? eventSession
          : current,
      );
      authoringEventListenersRef.current.forEach((listener) => listener(event));
    },
    [id, sessionId],
  );
  const connection = useCourseAuthoringSocket({
    courseId: id,
    session,
    onSnapshot: handleSnapshot,
    onEvent: handleEvent,
    onRefresh: refetchSnapshot,
    onSessionUnavailable,
  });
  const projection = useMemo(
    () => projectWorkspaceRecords(visibleRecords, session?.tasks ?? []),
    [visibleRecords, session?.tasks],
  );
  const lastProjectionRecoveryRef = useRef<string | null>(null);
  useEffect(() => {
    if (projection.unsupportedRecordCount === 0) {
      lastProjectionRecoveryRef.current = null;
      return;
    }
    const fingerprint = visibleRecords.map((record) => record.id).join(":");
    if (lastProjectionRecoveryRef.current === fingerprint) return;
    lastProjectionRecoveryRef.current = fingerprint;
    void refetchSnapshot();
  }, [projection.unsupportedRecordCount, refetchSnapshot, visibleRecords]);
  useEffect(() => {
    const application = readTrackedApplication(id, sessionId);
    if (!application?.confirmed) return;
    if (
      application.proposalIds.every((proposalId) =>
        projection.proposals.some(
          (proposal) => proposal.id === proposalId && proposal.decision === "applied",
        ),
      )
    ) {
      writeTrackedApplication(id, sessionId, null);
    }
  }, [id, projection.proposals, sessionId]);
  useEffect(() => {
    if (!trackedApplication?.confirmed) return;
    void refreshAfterConfirmedApply(trackedApplication.exportId);
  }, [refreshAfterConfirmedApply, trackedApplication]);
  const attemptedTargetIds = useMemo(
    () =>
      new Set(
        context?.chapters.flatMap((chapter) => [
          ...(chapter.lessons.some((lesson) => (lesson.assessmentAttemptCount ?? 0) > 0)
            ? [chapter.id]
            : []),
          ...chapter.lessons
            .filter((lesson) => (lesson.assessmentAttemptCount ?? 0) > 0)
            .map((lesson) => lesson.id),
        ]) ?? [],
      ),
    [context?.chapters],
  );
  const curriculumPreview = useMemo(() => {
    if (session?.status === "discarded") return null;

    const preview = latestCurriculumPreview(
      projection.proposals,
      projection.previews,
      appliedProposalIds,
    );
    return preview
      ? {
          ...preview,
          sources: projection.sources,
          targetedMentorOperationIds: targetedMentorOperationIds(session?.records ?? []),
          authoringSessionId: session?.sessionId,
          readyAssetIds: projection.readyAssetIds,
        }
      : null;
  }, [
    appliedProposalIds,
    projection.previews,
    projection.proposals,
    projection.sources,
    projection.readyAssetIds,
    session?.sessionId,
    session?.records,
    session?.status,
  ]);

  useEffect(() => {
    onCurriculumPreviewChange?.(curriculumPreview);
  }, [curriculumPreview, onCurriculumPreviewChange]);
  const mutateAuthoringCommand = commandMutation.mutateAsync;
  const sendChatCommand = useCallback(
    (
      commandInput: Omit<AuthoringCommand, "schemaVersion" | "commandId"> & {
        commandId: string;
      },
    ) => mutateAuthoringCommand(commandInput),
    [mutateAuthoringCommand],
  );
  const getAuthoringSession = useCallback(() => authoringSessionRef.current, []);
  const authoringChat = useCourseAuthoringChat({
    chatId: session?.sessionId ?? `course-authoring-${id}`,
    conversation: projection.conversation,
    turns: visibleTurns,
    sendCommand: sendChatCommand,
    subscribe: subscribeAuthoringEvents,
    getSession: getAuthoringSession,
  });
  const busy = commandMutation.isPending;
  /** Finalizes a durable receipt exactly once, without letting a refresh failure block later work. */
  const completeAppliedApplication = useCallback(
    async (applicationExportId: string) => {
      const notificationKey = `${applicationExportId}:applied`;
      if (notifiedApplicationRef.current === notificationKey) return;
      notifiedApplicationRef.current = notificationKey;
      setPendingApplyRequest(null);
      setAppliedProposalIds((current) => {
        const next = new Set(current);
        lastSubmittedApplyProposalIdsRef.current.forEach((proposalId) => next.add(proposalId));
        return next;
      });
      writeTrackedApplication(id, sessionId, {
        exportId: applicationExportId,
        proposalIds: lastSubmittedApplyProposalIdsRef.current,
        confirmed: true,
      });
      try {
        await refreshAfterConfirmedApply(applicationExportId);
        onCurriculumPreviewChange?.(null);
        toast({ description: t("courseAuthoring.conversation.applied") });
      } catch {
        toast({
          description: t("courseAuthoring.errors.appliedRefreshPending"),
        });
      } finally {
        lastSubmittedApplyProposalIdsRef.current = [];
        setExportId(null);
        setApplyState("idle");
      }
    },
    [id, onCurriculumPreviewChange, refreshAfterConfirmedApply, sessionId, t, toast],
  );
  const applyMutation = useApplyCourseAuthoringProposals({
    courseId: id,
    sessionId: session?.sessionId,
    onPreparing: () => setApplyState("preparing"),
    onSuccess: async (result) => {
      activeApplicationRef.current = result.exportId;
      writeTrackedApplication(id, sessionId, {
        exportId: result.exportId,
        proposalIds: lastSubmittedApplyProposalIdsRef.current,
      });
      setExportId(result.exportId);
      if (result.status === "applied") {
        await completeAppliedApplication(result.exportId);
        return;
      }
      setApplyState(
        result.status === "queued" || result.status === "running" ? "applying" : result.status,
      );
    },
    onError: (error) => {
      const message = isAxiosError(error) ? error.response?.data?.message : null;
      const errorKey = Array.isArray(message) ? message[0] : message;
      if (errorKey === "courseAuthoring.errors.receiptSynchronizationPending") {
        setApplyState("synchronizing");
        toast({ description: t("courseAuthoring.errors.receiptSynchronizationPending") });
        return;
      }
      setApplyState("failed");
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("courseAuthoring.errors.applicationFailed"),
        ),
      });
    },
  });
  const reviewBusy =
    busy ||
    applyMutation.isPending ||
    applyState === "preparing" ||
    applyState === "synchronizing" ||
    applyState === "applying";
  const applicationQuery = useCourseAuthoringApplicationQuery(id, session?.sessionId, exportId);
  useEffect(() => {
    const result = applicationQuery.data;
    if (!result) return;
    if (result.status === "queued" || result.status === "running") {
      activeApplicationRef.current = result.exportId;
      setApplyState("applying");
      return;
    }
    if (result.status === "applied") {
      void completeAppliedApplication(result.exportId);
      return;
    }
    setApplyState(result.status);
    const notificationKey = `${result.exportId}:${result.status}`;
    if (notifiedApplicationRef.current === notificationKey) return;
    notifiedApplicationRef.current = notificationKey;
    if (result.status === "conflict" || result.status === "failed") {
      // Restore historical status without announcing an old failure as a new error.
      if (activeApplicationRef.current !== result.exportId) return;
      activeApplicationRef.current = null;
      toast({
        variant: "destructive",
        description:
          result.reason?.startsWith("courseAuthoring.errors.") ||
          result.reason === "adminCourseView.toast.languageNotSupported"
            ? t(result.reason, { defaultValue: t("courseAuthoring.errors.applicationFailed") })
            : t("courseAuthoring.errors.applicationFailed"),
      });
      return;
    }
    setExportId(null);
    writeTrackedApplication(id, sessionId, null);
    setApplyState("idle");
  }, [applicationQuery.data, completeAppliedApplication, id, sessionId, t, toast]);

  /** Sends a workspace command and reports a localized success message. */
  const command = (body: Parameters<typeof commandMutation.mutate>[0], success?: string) => {
    commandMutation.mutate(body, {
      onSuccess: () => success && toast({ description: success }),
      onError: (error) => {
        toast({
          variant: "destructive",
          description: getTranslatedApiErrorMessage(
            error,
            t,
            t("courseAuthoring.errors.invalidCommand"),
          ),
        });
      },
    });
  };
  /** Keeps targeted feedback until the durable regeneration command is accepted. */
  const regenerateProposal = async (proposal: ProposalView, feedback?: string) => {
    const body = {
      action: "proposal.regenerate" as const,
      targetId: proposal.id,
      expectedRevision: proposal.revision,
      ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
    };
    if (!feedback?.trim()) {
      command(body);
      return;
    }
    try {
      await commandMutation.mutateAsync(body);
    } catch (error) {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("courseAuthoring.errors.invalidCommand"),
        ),
      });
      throw error;
    }
  };
  const regenerateProposalBatch = useCallback(
    async (regenerations: ProposalRegeneration[]) => {
      if (regenerations.length === 0) return;
      try {
        await commandMutation.mutateAsync({
          action: "proposal.regenerate.batch",
          commandId: crypto.randomUUID(),
          regenerations,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          description: getTranslatedApiErrorMessage(
            error,
            t,
            t("courseAuthoring.errors.invalidCommand"),
          ),
        });
        throw error;
      }
    },
    [commandMutation, t, toast],
  );
  const sendProposalFeedbackBatch = useCallback(
    async (
      proposalViews: ProposalView[],
      feedbacks: Array<{ proposalId: string; feedback: string }>,
    ) => {
      const proposalsById = new Map(proposalViews.map((proposal) => [proposal.id, proposal]));
      const regenerations = feedbacks.flatMap(({ proposalId, feedback }) => {
        const proposal = proposalsById.get(proposalId);
        return proposal
          ? [
              {
                targetId: proposal.id,
                expectedRevision: proposal.revision,
                feedback: feedback.trim(),
              },
            ]
          : [];
      });
      if (regenerations.length !== feedbacks.length) {
        toast({
          variant: "destructive",
          description: t("courseAuthoring.errors.invalidCommand"),
        });
        throw new Error("AUTHORING_PROPOSAL_NOT_FOUND");
      }
      await regenerateProposalBatch(regenerations);
    },
    [regenerateProposalBatch, t, toast],
  );
  /** Records an explicit proposal decision. Educational warnings remain informational. */
  const decideProposal = useCallback(
    async (proposal: ProposalView, accepted: boolean) => {
      try {
        await commandMutation.mutateAsync({
          action: accepted ? "proposal.accept" : "proposal.reject",
          targetId: proposal.id,
          expectedRevision: proposal.revision,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          description: getTranslatedApiErrorMessage(
            error,
            t,
            t("courseAuthoring.errors.invalidCommand"),
          ),
        });
        throw error;
      }
    },
    [commandMutation, t, toast],
  );

  /** Resume the waiting task, then keep the grant for future requests. */
  const answerQuestion = async (question: QuestionView, answer: string) => {
    try {
      await commandMutation.mutateAsync({
        action: "question.answer",
        targetId: question.taskId,
        expectedRevision: question.revision,
        answer,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("courseAuthoring.errors.invalidCommand"),
        ),
      });
      throw error;
    }
    if (question.capability === "web_search" && answer === "allow") {
      const currentPolicy =
        latestSourcePolicyRef.current ?? projection.sourcePolicy ?? freshSessionPolicy;
      const nextPolicy = { ...currentPolicy, webEnabled: true };
      try {
        await commandMutation.mutateAsync({ action: "sources.select", sourcePolicy: nextPolicy });
        latestSourcePolicyRef.current = nextPolicy;
      } catch {
        toast({ description: t("courseAuthoring.errors.webSearchPreferenceNotSaved") });
      }
    }
  };
  /** Dispatches the dedicated asset approval or retry command. */
  const actOnAsset = (asset: AssetTaskView, action: "asset.retry_submission") => {
    if (asset.revision === null) return;
    command({ action, targetId: asset.taskId, expectedRevision: asset.revision });
  };
  /** Persists the explicit source policy selected for future requests. */
  const selectSources = useCallback(
    (sourcePolicy: SourcePolicy) => {
      if (!session || session.status !== "active") return;
      latestSourcePolicyRef.current = sourcePolicy;
      commandMutation.mutate({ action: "sources.select", sourcePolicy });
    },
    [commandMutation, session],
  );
  /** Reapplies an explicit source replacement and the author's selected lesson tasks. */
  const refreshSource = useCallback(
    (
      oldSourceVersionId: string,
      replacementSourceVersionId: string,
      sourcePolicy?: SourcePolicy,
      selectedTaskIds?: string[],
    ) => {
      if (!session || session.status !== "active") return;
      commandMutation.mutate({
        action: "source.refresh",
        targetId: oldSourceVersionId,
        replacementSourceVersionId,
        ...(sourcePolicy ? { sourcePolicy } : {}),
        ...(selectedTaskIds?.length ? { selectedTaskIds } : {}),
      });
    },
    [commandMutation, session],
  );
  useEffect(() => {
    if (!session || sourcePolicySessionRef.current === session.sessionId) return;
    sourcePolicySessionRef.current = session.sessionId;
    latestSourcePolicyRef.current = projection.sourcePolicy;
  }, [projection.sourcePolicy, session]);
  const uploadMutation = useUploadCourseAuthoringSource({
    courseId: id,
    language,
    sessionId: session?.sessionId,
  });

  /** Starts application for accepted proposals after all safeguards pass. */
  const applySelected = useCallback(
    async (
      proposalIds: string[],
      acknowledgeAssessmentChanges: boolean,
      omitOptionalAssetIds: string[],
      commandId: string = crypto.randomUUID(),
    ) => {
      lastSubmittedApplyProposalIdsRef.current = proposalIds;
      const latestSession = authoringSessionRef.current;
      const latestProposals = latestSession
        ? projectWorkspaceRecords(latestSession.records, latestSession.tasks).proposals
        : projection.proposals;
      const optionalAssetIds = new Set(
        latestProposals
          .filter((proposal) => proposalIds.includes(proposal.id))
          .flatMap((proposal) => proposal.assetRequests ?? [])
          .filter((asset) => !asset.required)
          .map((asset) => asset.assetId),
      );
      const request = {
        proposalIds,
        acknowledgeAssessmentChanges,
        omitOptionalAssetIds: [
          ...new Set([...omitOptionalAssetIds, ...omittedOptionalAssetIdsRef.current]),
        ].filter((assetId) => optionalAssetIds.has(assetId)),
        commandId,
      };
      setPendingApplyRequest(request);
      await applyMutation.mutateAsync(request);
    },
    [applyMutation, projection.proposals],
  );
  /** Commits one request-level decision set, then submits exactly one atomic native apply selection. */
  const reviewGroupAndApply = useCallback(
    async (
      requestId: string,
      proposals: ProposalView[],
      selectedProposalIds: string[],
      {
        acknowledgeAssessmentChanges = false,
        rejectedProposalIds = [],
      }: {
        acknowledgeAssessmentChanges?: boolean;
        rejectedProposalIds?: string[];
      } = {},
    ) => {
      const latestSession = authoringSessionRef.current;
      const latestProposals = latestSession
        ? projectWorkspaceRecords(latestSession.records, latestSession.tasks).proposals
        : proposals;
      if (
        selectedProposalIds.length > 0 &&
        requestGenerationPending(latestSession?.tasks ?? [], requestId, latestProposals)
      ) {
        throw new Error(t("courseAuthoring.errors.proposalNotReady"));
      }
      // Withdraw an entire draft request, including an already approved outline.
      // proposal.review only accepts pending proposals; request.discard preserves applied history.
      const discardable = proposals.filter(
        (proposal) =>
          (proposal.decision === "pending" || proposal.decision === "accepted") &&
          !appliedProposalIds.has(proposal.id),
      );
      if (
        selectedProposalIds.length === 0 &&
        discardable.length > 0 &&
        discardable.every((proposal) => rejectedProposalIds.includes(proposal.id))
      ) {
        try {
          await commandMutation.mutateAsync({
            action: "request.discard",
            commandId: crypto.randomUUID(),
            targetId: requestId,
          });
        } catch (error) {
          toast({
            variant: "destructive",
            description: getTranslatedApiErrorMessage(
              error,
              t,
              t("courseAuthoring.errors.invalidCommand"),
            ),
          });
          throw error;
        }
        return;
      }
      const selected = proposals.filter(
        (proposal) =>
          selectedProposalIds.includes(proposal.id) &&
          proposal.decision !== "applied" &&
          !appliedProposalIds.has(proposal.id),
      );
      const closure = proposalDependencyClosure(
        selected.map((proposal) => proposal.id),
        projection.proposals,
      );
      if (closure.missingDependencies.length > 0) {
        toast({
          variant: "destructive",
          description: t("courseAuthoring.errors.missingDependency"),
        });
        throw new Error("AUTHORING_MISSING_PROPOSAL_DEPENDENCY");
      }
      const selectedIds = new Set(
        closure.ids.filter((proposalId) => {
          const proposal = projection.proposals.find((item) => item.id === proposalId);
          return proposal?.decision !== "applied" && !appliedProposalIds.has(proposalId);
        }),
      );
      const reviews = proposals
        .filter((proposal) => proposal.decision === "pending" && selectedIds.has(proposal.id))
        .map((proposal) => ({
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          accepted: true,
        }));
      // Rejections staged in the same review travel in the same session-locked command.
      proposals
        .filter(
          (proposal) =>
            proposal.decision === "pending" &&
            rejectedProposalIds.includes(proposal.id) &&
            !selectedIds.has(proposal.id),
        )
        .forEach((proposal) =>
          reviews.push({
            proposalId: proposal.id,
            expectedRevision: proposal.revision,
            accepted: false,
          }),
        );
      if (reviews.length > 0) {
        try {
          await commandMutation.mutateAsync({
            action: "proposal.review",
            commandId: crypto.randomUUID(),
            requestId,
            reviews,
          });
        } catch (error) {
          toast({
            variant: "destructive",
            description: getTranslatedApiErrorMessage(
              error,
              t,
              t("courseAuthoring.errors.invalidCommand"),
            ),
          });
          throw error;
        }
      }
      const applicableIds = [...selectedIds].filter((proposalId) =>
        projection.proposals.some(
          (proposal) => proposal.id === proposalId && proposal.operations.length > 0,
        ),
      );
      if (applicableIds.length > 0)
        await applySelected(applicableIds, acknowledgeAssessmentChanges, []);
    },
    [appliedProposalIds, applySelected, commandMutation, projection.proposals, t, toast],
  );
  /** Reviews a single result and starts its native apply, including required same-request changes. */
  const applyProposal = useCallback(
    async (proposal: ProposalView) => {
      const requestId = session?.tasks.find((task) => task.taskId === proposal.taskId)?.requestId;
      if (requestId) {
        const proposals = projection.proposals.filter((item) =>
          session?.tasks.some(
            (task) => task.taskId === item.taskId && task.requestId === requestId,
          ),
        );
        await reviewGroupAndApply(requestId, proposals, [proposal.id]);
        return;
      }
      if (proposal.decision === "pending") {
        await decideProposal(proposal, true);
      }
      if (proposal.operations.length === 0) return;
      await applySelected([proposal.id], false, []);
    },
    [applySelected, decideProposal, projection.proposals, reviewGroupAndApply, session?.tasks],
  );
  /** Saves explicit rejection decisions without changing omitted items into rejected items. */
  const preparePreview = useCallback(
    (build: () => CurriculumPreview | null) => {
      try {
        return build();
      } catch {
        toast({
          variant: "destructive",
          description: t("courseAuthoring.errors.previewUnavailable"),
        });
        return null;
      }
    },
    [t, toast],
  );
  /** Opens a request's proposals in curriculum review mode, bound to one batch apply. */
  const previewProposalGroupInCurriculum = useCallback(
    (requestId: string, proposals: ProposalView[], focusProposalId?: string) => {
      if (requestGenerationPending(session?.tasks ?? [], requestId, projection.proposals)) return;
      const appliedIds = new Set([
        ...appliedProposalIds,
        ...Object.entries(applicationStatusByProposalId)
          .filter(([, status]) => status === "applied")
          .map(([proposalId]) => proposalId),
      ]);
      const currentProposals = excludeAppliedProposals(proposals, appliedIds);
      const preview = preparePreview(() =>
        curriculumPreviewFromProposals(
          currentProposals,
          context,
          `request-${requestId}`,
          session?.applicationDelta,
        ),
      );
      if (!preview || !onPreviewProposalInCurriculum) return;
      const reviewable = currentProposals.filter(
        (proposal) => proposal.decision === "pending" || proposal.decision === "accepted",
      );
      onPreviewProposalInCurriculum(
        {
          ...preview,
          sources: projection.sources,
          targetedMentorOperationIds: targetedMentorOperationIds(session?.records ?? []),
          authoringSessionId: session?.sessionId,
          readyAssetIds: projection.readyAssetIds,
          proposals: toReviewProposals(reviewable),
          focusProposalId,
          courseTitle: context?.title,
          assessedLessonIds: [...attemptedTargetIds],
        },
        {
          applyReview: ({
            acceptedProposalIds,
            rejectedProposalIds,
            acknowledgeAssessmentChanges,
          }) =>
            reviewGroupAndApply(requestId, currentProposals, acceptedProposalIds, {
              acknowledgeAssessmentChanges,
              rejectedProposalIds,
            }),
          refineBatch: (feedbacks) => sendProposalFeedbackBatch(currentProposals, feedbacks),
        },
      );
    },
    [
      applicationStatusByProposalId,
      appliedProposalIds,
      preparePreview,
      session?.applicationDelta,
      attemptedTargetIds,
      context,
      onPreviewProposalInCurriculum,
      projection.sources,
      projection.proposals,
      session?.tasks,
      session?.records,
      projection.readyAssetIds,
      session?.sessionId,
      reviewGroupAndApply,
      sendProposalFeedbackBatch,
    ],
  );
  /** Opens one result in review mode; grouped results open with their whole request. */
  const previewProposalInCurriculum = useCallback(
    (proposal: ProposalView) => {
      const requestId = session?.tasks.find((task) => task.taskId === proposal.taskId)?.requestId;
      if (requestId) {
        const proposals = projection.proposals.filter((item) =>
          session?.tasks.some(
            (task) => task.taskId === item.taskId && task.requestId === requestId,
          ),
        );
        previewProposalGroupInCurriculum(requestId, proposals, proposal.id);
        return;
      }
      const preview = preparePreview(() =>
        curriculumPreviewFromProposal(proposal, context, session?.applicationDelta),
      );
      if (!preview || !onPreviewProposalInCurriculum) return;
      onPreviewProposalInCurriculum(
        {
          ...preview,
          sources: projection.sources,
          targetedMentorOperationIds: targetedMentorOperationIds(session?.records ?? []),
          authoringSessionId: session?.sessionId,
          readyAssetIds: projection.readyAssetIds,
          proposals: toReviewProposals([proposal]),
          focusProposalId: proposal.id,
          courseTitle: context?.title,
          assessedLessonIds: [...attemptedTargetIds],
        },
        {
          applyReview: async ({ acceptedProposalIds }) => {
            if (acceptedProposalIds.includes(proposal.id)) {
              await applyProposal(proposal);
              return;
            }
            await decideProposal(proposal, false);
          },
          refineBatch: (feedbacks) => sendProposalFeedbackBatch([proposal], feedbacks),
        },
      );
    },
    [
      applyProposal,
      attemptedTargetIds,
      context,
      decideProposal,
      onPreviewProposalInCurriculum,
      previewProposalGroupInCurriculum,
      preparePreview,
      session?.applicationDelta,
      projection.proposals,
      projection.sources,
      session?.records,
      projection.readyAssetIds,
      session?.sessionId,
      sendProposalFeedbackBatch,
      session?.tasks,
    ],
  );
  /** Retries receipt synchronization after a previously applied export. */
  const retryPendingApply = async () => {
    if (!pendingApplyRequest) return;
    try {
      await refetchSnapshot();
      applyMutation.mutate(pendingApplyRequest);
    } catch (error) {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("courseAuthoring.errors.invalidCommand"),
        ),
      });
    }
  };

  if (sessionQuery.isError || contextQuery.isError) {
    return (
      <PageWrapper>
        <ErrorState
          onRetry={() => void Promise.all([sessionQuery.refetch(), contextQuery.refetch()])}
        />
      </PageWrapper>
    );
  }

  const sourceTaskIds = new Set(
    projection.sources.flatMap((source) => (source.taskId ? [source.taskId] : [])),
  );
  const agentTasks = attachAuthoringWorkProgress(
    session?.tasks.filter(
      (task) => !sourceTaskIds.has(task.taskId) && !["route", "source"].includes(task.kind ?? ""),
    ) ?? [],
    session?.records ?? [],
  );
  const knownTaskLabels = Object.fromEntries([
    ...projection.proposals.flatMap((proposal) =>
      proposal.taskId ? [[proposal.taskId, proposal.summary]] : [],
    ),
    ...projection.previews.flatMap((preview) => {
      const title = preview.lessonTitle ?? preview.title;
      return title ? [[preview.taskId, title]] : [];
    }),
  ]);
  const taskLabels = authoringTaskDisplayLabels(agentTasks, knownTaskLabels, t);
  const turnByRequestId = new Map((session?.turns ?? []).map((turn) => [turn.requestId, turn]));
  const activeTurnRequestIds = authoringChat.awaitingRequestReceipt
    ? new Set<string>()
    : activeAssistantRequestIds(session?.turns, projection.conversation, authoringChat.messages);
  const requestCanStillRun = (requestId: string) => {
    const turn = turnByRequestId.get(requestId);
    return !turn || ["queued", "running"].includes(turn.status);
  };
  const canonicalTools = canonicalToolTaskState(authoringChat.messages);
  const chatRequestId = activeChatRequestId(authoringChat.messages, authoringChat.status);
  const chatIsProcessing = chatRequestId !== null || activeTurnRequestIds.size > 0;
  // Requests whose work already has a visible task: Live work shows them, so the standalone
  // "..." indicator below must not repeat the same status for the same task.
  const requestIdsWithVisibleTask = new Set(
    agentTasks
      .filter(
        (task) =>
          ["queued", "running"].includes(task.status) &&
          requestCanStillRun(task.requestId) &&
          activeTurnRequestIds.has(task.requestId) &&
          !isDuplicateResearchTask(
            task,
            canonicalTools.taskIdsByRequest.get(task.requestId) ?? new Set<string>(),
          ),
      )
      .map((task) => task.requestId),
  );
  const pendingAssistantTasks: { taskId: string; requestId: string; phaseLabel?: string }[] = [];
  activeTurnRequestIds.forEach((requestId) => {
    if (requestIdsWithVisibleTask.has(requestId)) return;
    if (canonicalTools.activeRequestIds.has(requestId)) return;
    pendingAssistantTasks.push({
      taskId: `turn-${requestId}`,
      requestId,
      phaseLabel: t("courseAuthoring.conversation.preparingResponse"),
    });
  });
  if (
    chatRequestId &&
    !pendingAssistantTasks.some((task) => task.requestId === chatRequestId) &&
    !requestIdsWithVisibleTask.has(chatRequestId) &&
    !canonicalTools.activeRequestIds.has(chatRequestId)
  ) {
    pendingAssistantTasks.push({
      taskId: `chat-${chatRequestId}`,
      requestId: chatRequestId,
      phaseLabel: t("courseAuthoring.conversation.preparingResponse"),
    });
  }
  const workParts = projectAuthoringTimeline(authoringChat.messages).filter(
    (item): item is Extract<AuthoringTimelineItem<unknown>, { kind: "part" }> =>
      item.kind === "part",
  );
  const livePlans = workParts.flatMap((item) =>
    item.part.data.partKind === "text" && item.part.data.planSteps?.length
      ? [
          {
            id: item.part.data.partId,
            requestId: item.requestId,
            taskId: item.part.data.taskId ?? null,
            partId: item.part.data.partId,
            firstSequence: item.part.data.firstSequence,
            message: item.part.data.text ?? "",
            planSteps: item.part.data.planSteps,
          },
        ]
      : [],
  );
  const livePlanPartIds = new Set(livePlans.map((plan) => plan.partId));
  const plans = [
    ...livePlans,
    ...projection.assistantMessages.flatMap((message) =>
      message.requestId && message.planSteps?.length && !livePlanPartIds.has(message.partId ?? "")
        ? [
            {
              id: message.id,
              requestId: message.requestId,
              taskId: message.taskId,
              partId: message.partId ?? null,
              firstSequence:
                workParts.find((item) => item.part.data.partId === message.partId)?.part.data
                  .firstSequence ?? message.firstSequence,
              message: message.message,
              planSteps: message.planSteps,
            },
          ]
        : [],
    ),
  ];
  const activityTasks = agentTasks.filter((task) => {
    const toolTaskIds = canonicalTools.taskIdsByRequest.get(task.requestId) ?? new Set<string>();
    return !isDuplicateResearchTask(task, toolTaskIds);
  });
  const taskById = new Map((session?.tasks ?? []).map((task) => [task.taskId, task]));
  const toolParts = workParts.filter(
    (item) => item.part.data.partKind === "tool" && item.part.data.tool,
  );
  const requestIdsWithWork = new Set([
    ...activityTasks.map((task) => task.requestId),
    ...projection.assetTasks.flatMap((asset) => {
      const task = taskById.get(asset.taskId);
      return task && !sourceTaskIds.has(task.taskId) ? [task.requestId] : [];
    }),
    ...toolParts.map((item) => item.requestId),
  ]);
  const taskActivities = [...requestIdsWithWork].flatMap((requestId) => {
    const requestTasks = activityTasks.filter((task) => task.requestId === requestId);
    const assetTasks = projection.assetTasks.filter(
      (asset) => taskById.get(asset.taskId)?.requestId === requestId,
    );
    const requestWorkParts = workParts.filter((item) => item.requestId === requestId);
    const hasLessonWork =
      requestWorkParts.some((item) => item.part.data.partKind === "proposal") &&
      requestTasks.some((task) => ["detailed_plan", "lesson"].includes(task.kind ?? ""));
    const stages = hasLessonWork
      ? [
          {
            phase: "outline",
            tasks: requestTasks.filter(
              (task) => !["detailed_plan", "lesson"].includes(task.kind ?? ""),
            ),
          },
          {
            phase: "lessons",
            tasks: requestTasks.filter((task) =>
              ["detailed_plan", "lesson"].includes(task.kind ?? ""),
            ),
          },
        ]
      : [{ phase: "request", tasks: requestTasks }];
    const outlineProposals = requestWorkParts.filter((item) => {
      if (item.part.data.partKind !== "proposal") return false;
      const proposalTask = taskById.get(item.part.data.taskId ?? "");
      return proposalTask?.kind !== "lesson" && proposalTask?.kind !== "detailed_plan";
    });
    const outlineSequence = Math.max(
      ...outlineProposals.map((item) => item.part.data.firstSequence),
    );
    return stages.flatMap(({ phase, tasks }) => {
      if (tasks.length === 0 && (phase !== "lessons" || assetTasks.length === 0)) return [];
      const stageTaskIds = new Set(tasks.map((task) => task.taskId));
      const taskSequences = Object.fromEntries(
        tasks.map((task) => [
          task.taskId,
          Math.min(
            ...requestWorkParts
              .filter((item) => item.part.data.taskId === task.taskId)
              .map((item) => item.part.data.firstSequence),
          ),
        ]),
      );
      const tools = toolParts
        .filter(
          (item) =>
            item.requestId === requestId &&
            (phase === "request" ||
              (item.part.data.taskId && stageTaskIds.has(item.part.data.taskId)) ||
              (phase === "outline" && !item.part.data.taskId)),
        )
        .flatMap((item) =>
          item.part.data.tool
            ? [
                {
                  tool: item.part.data.tool,
                  taskId: item.part.data.taskId ?? undefined,
                  taskLabel: item.part.data.taskId ? taskLabels[item.part.data.taskId] : undefined,
                  sequence: item.part.data.firstSequence,
                },
              ]
            : [],
        );
      const firstWorkSequence = Math.min(
        ...requestWorkParts
          .filter((item) => item.part.data.taskId && stageTaskIds.has(item.part.data.taskId))
          .map((item) => item.part.data.firstSequence),
      );
      const planSequence = plans.find((plan) => plan.requestId === requestId)?.firstSequence;
      const initialSequence = Number.isFinite(firstWorkSequence)
        ? Math.max(firstWorkSequence, planSequence ?? firstWorkSequence)
        : (planSequence ?? Number.POSITIVE_INFINITY);
      let sequence = initialSequence;
      if (phase === "lessons" && Number.isFinite(outlineSequence)) {
        sequence = outlineSequence + 0.5;
      }
      return {
        taskId: `request-${requestId}-${phase}`,
        requestId,
        sequence: Number.isFinite(sequence) ? sequence : undefined,
        toolsIncluded: true,
        content: (
          <AuthoringActivityRail
            key={`activity-${requestId}-${phase}`}
            compact
            tasks={tasks}
            tools={tools}
            taskSequences={taskSequences}
            taskLabels={taskLabels}
            questions={[]}
            assetTasks={phase === "lessons" || phase === "request" ? assetTasks : []}
            applications={[]}
            connection={connection}
            busy={busy}
            onRetry={(retryTaskId) => command({ action: "task.retry", targetId: retryTaskId })}
            onStopRequest={(requestId) => command({ action: "request.stop", targetId: requestId })}
            onDiscardRequest={(requestId) =>
              command({ action: "request.discard", targetId: requestId })
            }
            onAnswer={answerQuestion}
            onAssetAction={actOnAsset}
            onSkipAsset={(assetId) =>
              setOmittedOptionalAssetIds((current) =>
                current.includes(assetId)
                  ? current.filter((id) => id !== assetId)
                  : [...current, assetId],
              )
            }
          />
        ),
      };
    });
  });
  const questionsByRequest = projection.questions.reduce<Record<string, QuestionView[]>>(
    (groups, question) => {
      if (!question.requestId) return groups;
      groups[question.requestId] = [...(groups[question.requestId] ?? []), question];
      return groups;
    },
    {},
  );
  const visibleTasks = (session?.tasks ?? []).filter((task) => !sourceTaskIds.has(task.taskId));
  const generationPending = (requestId: string) =>
    requestGenerationPending(session?.tasks ?? [], requestId, projection.proposals);
  const requestIdByTaskId = new Map(visibleTasks.map((task) => [task.taskId, task.requestId]));
  const proposalsByRequest = projection.proposals.reduce<Map<string, ProposalView[]>>(
    (groups, proposal) => {
      const requestId = proposal.taskId ? requestIdByTaskId.get(proposal.taskId) : undefined;
      if (!requestId) return groups;
      groups.set(requestId, [...(groups.get(requestId) ?? []), proposal]);
      return groups;
    },
    new Map(),
  );
  const proposalById = Object.fromEntries(
    projection.proposals.flatMap((proposal) => {
      const requestId = proposal.taskId ? requestIdByTaskId.get(proposal.taskId) : undefined;
      if (requestId && proposalsByRequest.has(requestId)) return [];
      const applicationStatus = applicationStatusByProposalId[proposal.id];
      const canRetryApplication =
        (applicationStatus === "failed" || applicationStatus === "synchronizing") &&
        pendingApplyRequest !== null;
      return [
        [
          proposal.id,
          <ProposalGroup
            key={proposal.id}
            requestId={proposal.id}
            proposals={[proposal]}
            busy={reviewBusy}
            generationPending={Boolean(requestId && generationPending(requestId))}
            onReview={() => previewProposalInCurriculum(proposal)}
            onDiscard={() => void decideProposal(proposal, false)}
            targetLabelById={targetLabelById}
            applicationStatusByProposalId={applicationStatusByProposalId}
            onRetryApply={canRetryApplication ? () => void retryPendingApply() : undefined}
            retryDisabled={busy || applyMutation.isPending}
          />,
        ],
      ];
    }),
  );
  const proposalGroups = [...proposalsByRequest.entries()].flatMap(
    ([requestId, requestProposals]) => {
      const taskId = requestProposals[0]?.taskId;
      if (!taskId) return [];
      return [
        {
          taskId,
          requestId,
          proposalIds: requestProposals.map((proposal) => proposal.id),
          content: (
            <ProposalGroup
              key={`proposal-group-${requestId}`}
              requestId={requestId}
              proposals={requestProposals}
              busy={reviewBusy}
              generationPending={generationPending(requestId)}
              onReview={(focusProposalId) =>
                previewProposalGroupInCurriculum(requestId, requestProposals, focusProposalId)
              }
              onDiscard={() =>
                void reviewGroupAndApply(requestId, requestProposals, [], {
                  rejectedProposalIds: requestProposals.map((proposal) => proposal.id),
                }).catch(() => undefined)
              }
              targetLabelById={targetLabelById}
              applicationStatusByProposalId={applicationStatusByProposalId}
              onRetryApply={pendingApplyRequest ? () => void retryPendingApply() : undefined}
              retryDisabled={busy || applyMutation.isPending}
            />
          ),
        },
      ];
    },
  );

  return (
    <PageWrapper
      isBarebones
      data-testid={COURSE_AUTHORING_HANDLES.ROOT}
      wrapperClassName={cn(
        "min-h-0 bg-white [&>div]:min-h-0",
        embedded ? "h-full" : "h-[calc(100dvh-64px)]",
      )}
      className="flex min-h-0 flex-1 flex-col px-4 py-3 md:px-6"
    >
      <header className="mb-3 flex shrink-0 items-center">
        {!embedded && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={t("courseAuthoring.conversation.back")}
          >
            <Link to={`/admin/beta-courses/${id}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        )}
      </header>

      {connection !== "live" && session && (
        <p role="status" className="mx-auto mb-4 max-w-3xl text-sm text-neutral-500">
          {t("courseAuthoring.conversation.reconnecting")}
        </p>
      )}

      {!session || !context ? (
        <LoadingState />
      ) : (
        <CourseGenerationInteraction
          hasExistingContent={context.chapters.length > 0}
          hasWork={
            projection.requests.length > 0 ||
            agentTasks.length > 0 ||
            projection.assistantMessages.length > 0 ||
            authoringChat.messages.length > 0 ||
            projection.proposals.length > 0 ||
            projection.previews.length > 0
          }
          activity={null}
          history={
            <>
              {(olderPages?.at(-1)?.hasMore ?? session.hasMoreTurns) && (
                <div className="flex justify-center py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={historyQuery.isFetchingNextPage}
                    onClick={() => void historyQuery.fetchNextPage()}
                  >
                    {t("courseAuthoring.conversation.loadEarlierMessages")}
                  </Button>
                </div>
              )}
              <AuthoringAssistantMessages
                chatMessages={authoringChat.messages}
                pendingTasks={pendingAssistantTasks}
                taskActivities={taskActivities}
                taskLabels={taskLabels}
                plans={plans}
                proposalById={proposalById}
                proposalGroups={proposalGroups}
                previews={projection.previews}
                questionsByRequest={questionsByRequest}
                onAnswerQuestion={answerQuestion}
                sources={projection.sources}
                onPreviewInCurriculum={onPreviewInCurriculum}
                chatError={authoringChat.error}
                onRetryChat={() => void authoringChat.retryLatestRequest()}
              />
            </>
          }
          composer={
            <AuthoringBriefPanel
              course={context}
              initialSourcePolicy={projection.sourcePolicy}
              sources={projection.sources}
              sourceRefreshes={projection.sourceRefreshes}
              onRefreshSource={refreshSource}
              sessionId={session.sessionId}
              reasoningControlAvailable={session.reasoningControlAvailable}
              disabled={session.status === "discarded"}
              isSubmitting={chatIsProcessing}
              hasActiveGeneration={session.status === "active" && chatIsProcessing}
              onStopGeneration={() => {
                command({ action: "session.stop" });
                authoringChat.stop();
              }}
              onSubmit={authoringChat.sendRequest}
              onSelectSources={selectSources}
              onUploadSource={async (file) =>
                (await uploadMutation.mutateAsync(file)).sourceVersionId
              }
              isUploadingSource={uploadMutation.isPending}
            />
          }
          review={
            <ProposalReview
              compact
              showRequests={false}
              requests={projection.requests}
              tasks={agentTasks}
              proposals={projection.proposals}
              previews={[]}
              onPreviewInCurriculum={onPreviewInCurriculum}
              selectedProposalIds={selectedProposalIds}
              onSelectedProposalIdsChange={setSelectedProposalIds}
              renderCards={false}
              busy={busy || applyMutation.isPending}
              onAccept={applyProposal}
              onReject={(proposal) => decideProposal(proposal, false)}
              onRegenerate={regenerateProposal}
              onApply={applySelected}
              applyState={applyState}
              autoApplyReadyContent={false}
              attemptedTargetIds={[...attemptedTargetIds]}
              targetLabelById={targetLabelById}
              applicationStatusByProposalId={applicationStatusByProposalId}
              readyAssetIds={projection.readyAssetIds}
              omittedOptionalAssetIds={omittedOptionalAssetIds}
              onOmittedOptionalAssetIdsChange={setOmittedOptionalAssetIds}
            />
          }
          activityAndQuestions={null}
        />
      )}
    </PageWrapper>
  );
};
