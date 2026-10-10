/** Provides the compact course-authoring composer and controlled optional configuration surfaces. */
import { FileText, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { COURSE_AUTHORING_HANDLES } from "../../../../e2e/data/curriculum/handles";

import { AuthoringComposer } from "./AuthoringComposer";
import { AuthoringReasoningControl } from "./AuthoringReasoningControl";
import { getCourseAuthoringSourceError } from "./AuthoringSourcePopover";
import { AuthoringToolsPopover } from "./AuthoringToolsPopover";

import type {
  AuthoringRequest,
  CourseContext,
  SourcePolicy,
  SourceRefreshView,
  SourceView,
  TargetRef,
} from "../courseAuthoring.types";

export { getCourseAuthoringSourceError };

type Props = {
  course: CourseContext;
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: (request: AuthoringRequest) => Promise<void>;
  onSelectSources: (policy: SourcePolicy) => void;
  onUploadSource?: (file: File) => void | Promise<string | void>;
  isUploadingSource?: boolean;
  initialSourcePolicy?: SourcePolicy | null;
  sourcePolicySequence?: number | null;
  sources?: SourceView[];
  sourceRefreshes?: SourceRefreshView[];
  onRefreshSource?: (
    oldSourceVersionId: string,
    replacementSourceVersionId: string,
    sourcePolicy?: SourcePolicy,
    selectedTaskIds?: string[],
  ) => void;
  sessionId?: string;
  reasoningControlAvailable?: boolean;
  showExamples?: boolean;
  hasActiveGeneration?: boolean;
  onStopGeneration?: () => void;
};

type ComposerAttachment = { id: string; name: string; uploading: boolean };

const composerDraftStorageKey = (sessionId: string) =>
  `course-authoring-composer-draft:${sessionId}`;

/** Restores only completed uploads explicitly left in the composer for this session. */
const readComposerDraft = (sessionId: string): ComposerAttachment[] => {
  try {
    const stored = window.sessionStorage.getItem(composerDraftStorageKey(sessionId));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): ComposerAttachment[] =>
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      !item.id.startsWith("pending-") &&
      typeof item.name === "string"
        ? [{ id: item.id, name: item.name, uploading: false }]
        : [],
    );
  } catch {
    return [];
  }
};

const emptyPolicy: SourcePolicy = {
  sourceVersionIds: [],
  webEnabled: false,
  generalKnowledgeEnabled: false,
  researchDepth: "standard",
  requiredSectionIds: [],
  excludedSectionIds: [],
};

/** Starts a new session with a visible, explicit general-knowledge authority. */
export const freshSessionPolicy: SourcePolicy = {
  ...emptyPolicy,
  generalKnowledgeEnabled: true,
};

/** Builds course, chapter, lesson, and block targets from the current selection. */
export const buildAuthoringTargets = (
  course: CourseContext,
  selectedTargetIds: string[],
  selectedBlockIds: string[],
): TargetRef[] => {
  const entityTargets = selectedTargetIds.flatMap((targetId) => {
    const chapter = course.chapters.find((entry) => entry.id === targetId);
    const lesson = course.chapters
      .flatMap((entry) => entry.lessons)
      .find((entry) => entry.id === targetId);
    if (!chapter && !lesson) return [];
    return [
      {
        targetId,
        kind: chapter ? ("chapter" as const) : ("lesson" as const),
        language: course.language,
        baselineHash: chapter?.baselineHash ?? lesson?.baselineHash ?? null,
        blockIds: [],
        allowedFields: [],
      },
    ];
  });
  const blockTargets = course.chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((lesson) =>
      (lesson.blocks ?? []).flatMap((block) =>
        selectedBlockIds.includes(block.id)
          ? [
              {
                targetId: lesson.id,
                kind: "block" as const,
                language: course.language,
                baselineHash: block.baselineHash,
                blockIds: [block.id],
                allowedFields: [],
              },
            ]
          : [],
      ),
    ),
  );
  return [...entityTargets, ...blockTargets];
};

/** Renders the text-first request entry and keeps optional controls out of the default path. */
export const AuthoringBriefPanel = ({
  course,
  disabled,
  isSubmitting,
  onSubmit,
  onSelectSources,
  onUploadSource,
  isUploadingSource,
  initialSourcePolicy,
  sourcePolicySequence,
  sources = [],
  sourceRefreshes = [],
  onRefreshSource,
  sessionId,
  reasoningControlAvailable = false,
  showExamples = true,
  hasActiveGeneration = false,
  onStopGeneration,
}: Props) => {
  const { t } = useTranslation();
  const [instruction, setInstruction] = useState("");
  const [reasoningEffort, setReasoningEffort] =
    useState<AuthoringRequest["reasoningEffort"]>("medium");
  const [policy, setPolicy] = useState<SourcePolicy>(
    initialSourcePolicy === null ? freshSessionPolicy : (initialSourcePolicy ?? emptyPolicy),
  );
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [strictSourceMode, setStrictSourceMode] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [sourceUploadError, setSourceUploadError] = useState<string | null>(null);
  const [sourceSelectionError, setSourceSelectionError] = useState<string | null>(null);
  const pendingPolicySelectionsRef = useRef<SourcePolicy[]>([]);
  const incomingPolicyRef = useRef(policy);
  const incomingPolicySequenceRef = useRef(sourcePolicySequence ?? null);
  const policyRef = useRef(policy);
  const composerAttachmentsRef = useRef(composerAttachments);
  const sessionIdRef = useRef(sessionId);
  const hydratedDraftSessionRef = useRef<string | null>(null);
  const skipDraftWriteSessionRef = useRef<string | null>(null);

  /** Updates the rendered attachment list and its synchronous event-handler snapshot together. */
  const updateComposerAttachments = useCallback(
    (update: (current: ComposerAttachment[]) => ComposerAttachment[]) => {
      const next = update(composerAttachmentsRef.current);
      composerAttachmentsRef.current = next;
      setComposerAttachments(next);
    },
    [],
  );

  useEffect(() => {
    if (!sessionId || hydratedDraftSessionRef.current !== sessionId) return;
    if (skipDraftWriteSessionRef.current === sessionId) {
      skipDraftWriteSessionRef.current = null;
      return;
    }
    try {
      const pendingAttachments = composerAttachments.filter((attachment) => !attachment.uploading);
      if (pendingAttachments.length === 0) {
        window.sessionStorage.removeItem(composerDraftStorageKey(sessionId));
      } else {
        window.sessionStorage.setItem(
          composerDraftStorageKey(sessionId),
          JSON.stringify(pendingAttachments),
        );
      }
    } catch {
      // Storage is a convenience for recovering an unsent draft, not a requirement for sending.
    }
  }, [composerAttachments, sessionId]);

  useEffect(() => {
    const incomingPolicy =
      initialSourcePolicy === null ? freshSessionPolicy : (initialSourcePolicy ?? emptyPolicy);
    const previousSessionId = sessionIdRef.current;
    const sessionChanged = previousSessionId !== sessionId;
    if (sessionChanged) {
      sessionIdRef.current = sessionId;
      pendingPolicySelectionsRef.current = [];
      incomingPolicySequenceRef.current = null;
      setStrictSourceMode(false);
      // Upload acceptance may be the event that creates the first durable session.
      // Preserve its composer chip through that transition; clear only on a real switch.
      if (previousSessionId) {
        updateComposerAttachments(() => []);
      }
    }
    if (sessionId && hydratedDraftSessionRef.current !== sessionId) {
      const preserveNewSessionUpload =
        hydratedDraftSessionRef.current === null &&
        !previousSessionId &&
        composerAttachments.length > 0;
      if (!preserveNewSessionUpload) {
        updateComposerAttachments(() => readComposerDraft(sessionId));
      }
      hydratedDraftSessionRef.current = sessionId;
      skipDraftWriteSessionRef.current = sessionId;
    }
    const incomingSequence = sourcePolicySequence ?? null;
    const previousSequence = incomingPolicySequenceRef.current;
    if (
      !sessionChanged &&
      incomingSequence !== null &&
      previousSequence !== null &&
      incomingSequence <= previousSequence
    )
      return;
    const incomingKey = JSON.stringify(incomingPolicy);
    const previousKey = JSON.stringify(incomingPolicyRef.current);
    const selectionAdvanced =
      incomingSequence !== null &&
      (previousSequence === null || incomingSequence > previousSequence);
    if (pendingPolicySelectionsRef.current.length > 0 && !sessionChanged) {
      // Preserve unsaved local intent through unchanged/stale snapshots. A newer
      // durable selection (including an approved grant) must supersede it.
      if (!selectionAdvanced && incomingKey === previousKey) return;
      let acknowledgedIndex = -1;
      pendingPolicySelectionsRef.current.forEach((selection, index) => {
        if (JSON.stringify(selection) === incomingKey) acknowledgedIndex = index;
      });
      incomingPolicyRef.current = incomingPolicy;
      incomingPolicySequenceRef.current = incomingSequence;
      if (
        acknowledgedIndex >= 0 &&
        acknowledgedIndex < pendingPolicySelectionsRef.current.length - 1
      ) {
        pendingPolicySelectionsRef.current = pendingPolicySelectionsRef.current.slice(
          acknowledgedIndex + 1,
        );
        return;
      }
      pendingPolicySelectionsRef.current = [];
    }
    incomingPolicyRef.current = incomingPolicy;
    incomingPolicySequenceRef.current = incomingSequence;
    policyRef.current = incomingPolicy;
    setPolicy(incomingPolicy);
    if (incomingPolicy.webEnabled || incomingPolicy.generalKnowledgeEnabled)
      setStrictSourceMode(false);
  }, [
    composerAttachments.length,
    initialSourcePolicy,
    sourcePolicySequence,
    sessionId,
    updateComposerAttachments,
  ]);

  /** Updates source policy and persists the selection for future requests. */
  const updatePolicy = (next: SourcePolicy) => {
    pendingPolicySelectionsRef.current.push(next);
    policyRef.current = next;
    setPolicy(next);
    setSourceSelectionError(null);
    onSelectSources(next);
  };

  /** Tracks an upload in the composer until the durable source version is available. */
  const uploadSource = async (file: File) => {
    const pendingId = `pending-${crypto.randomUUID()}`;
    const uploadSessionId = sessionIdRef.current;
    updateComposerAttachments((current) => [
      ...current,
      { id: pendingId, name: file.name, uploading: true },
    ]);
    try {
      const sourceVersionId = await onUploadSource?.(file);
      if (!sourceVersionId) return;
      if (uploadSessionId !== sessionIdRef.current) return;
      const stillAttached = composerAttachmentsRef.current.some(
        (attachment) => attachment.id === pendingId,
      );
      if (!stillAttached) return;
      updateComposerAttachments((current) =>
        current.map((attachment) =>
          attachment.id === pendingId
            ? { id: sourceVersionId, name: file.name, uploading: false }
            : attachment,
        ),
      );
      const currentPolicy = policyRef.current;
      const nextPolicy = currentPolicy.sourceVersionIds.includes(sourceVersionId)
        ? currentPolicy
        : {
            ...currentPolicy,
            sourceVersionIds: [...currentPolicy.sourceVersionIds, sourceVersionId],
          };
      if (nextPolicy !== currentPolicy) updatePolicy(nextPolicy);
    } finally {
      updateComposerAttachments((current) =>
        current.filter((attachment) => attachment.id !== pendingId),
      );
    }
  };

  /** Validates a pasted file the same way the attach-file control does and uploads it if valid. */
  const handlePasteFile = (file: File) => {
    const error = getCourseAuthoringSourceError(file);
    setSourceUploadError(error);
    if (error) {
      setToolsOpen(true);
      return;
    }
    void uploadSource(file);
  };

  /** Disconnects an uploaded source from future requests while retaining the session source. */
  const removeAttachment = (attachmentId: string) => {
    updateComposerAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
    if (attachmentId.startsWith("pending-")) return;
    const currentPolicy = policyRef.current;
    updatePolicy({
      ...currentPolicy,
      sourceVersionIds: currentPolicy.sourceVersionIds.filter((id) => id !== attachmentId),
    });
  };

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const attachmentsProcessing =
    composerAttachments.some((attachment) => attachment.uploading) ||
    [...new Set([...policy.sourceVersionIds, ...composerAttachments.map((item) => item.id)])].some(
      (id) => {
        const status = sourceById.get(id)?.status;
        return status !== "ready";
      },
    );

  /** Opens the source picker instead of submitting a request without source authority. */
  const submitRequest = async () => {
    if (disabled || isSubmitting || !instruction.trim() || attachmentsProcessing) return;
    const currentPolicy = policyRef.current;
    const currentAttachments = composerAttachmentsRef.current;
    if (
      !strictSourceMode &&
      currentPolicy.sourceVersionIds.length === 0 &&
      !currentPolicy.webEnabled &&
      !currentPolicy.generalKnowledgeEnabled
    ) {
      setSourceSelectionError(t("courseAuthoring.sources.empty"));
      setToolsOpen(true);
      return;
    }
    const submittedInstruction = instruction.trim();
    const submittedAttachments = currentAttachments;
    const attachedSourceVersionIds = submittedAttachments
      .filter((attachment) => !attachment.uploading)
      .map((attachment) => attachment.id);
    setInstruction("");
    updateComposerAttachments(() => []);
    try {
      await onSubmit({
        instruction: submittedInstruction,
        reasoningEffort: reasoningControlAvailable ? reasoningEffort : "medium",
        targets: buildAuthoringTargets(course, selectedTargetIds, selectedBlockIds),
        sourcePolicy: currentPolicy,
        attachedSourceVersionIds,
        exactOutline: null,
      });
    } catch {
      setInstruction(submittedInstruction);
      updateComposerAttachments(() => submittedAttachments);
    }
  };

  const visibleAttachments: ComposerAttachment[] = [...composerAttachments];
  policy.sourceVersionIds.forEach((id) => {
    const source = sourceById.get(id);
    if (source?.status === "ready" || visibleAttachments.some((attachment) => attachment.id === id))
      return;
    visibleAttachments.push({
      id,
      name: source?.name ?? t("courseAuthoring.sources.label"),
      uploading: false,
    });
  });
  const attachmentChips = visibleAttachments.length > 0 && (
    <div className="mb-2 flex flex-wrap gap-2" data-testid="course-authoring-composer-attachments">
      {visibleAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex min-w-0 max-w-sm items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 shadow-sm"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
            {attachment.uploading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="size-4" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-xs font-medium text-neutral-800"
              title={attachment.name}
            >
              {attachment.name}
            </span>
            {!attachment.uploading && (
              <span className="block text-[11px] text-neutral-500">
                {t(
                  `courseAuthoring.sources.status.${sourceById.get(attachment.id)?.status ?? "processing"}`,
                )}
              </span>
            )}
          </span>
          <button
            type="button"
            className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label={`${t("courseAuthoring.tools.removeAttachment")} ${attachment.name}`}
            onClick={() => removeAttachment(attachment.id)}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
  return (
    <div data-testid={COURSE_AUTHORING_HANDLES.BRIEF_PANEL} className="space-y-3">
      <AuthoringComposer
        instruction={instruction}
        disabled={disabled}
        isSubmitting={isSubmitting}
        sendBlocked={attachmentsProcessing}
        hasActiveGeneration={hasActiveGeneration}
        onStopGeneration={onStopGeneration}
        onInstructionChange={setInstruction}
        onSubmit={() => void submitRequest()}
        onPasteFile={handlePasteFile}
        showExamples={showExamples}
        reasoningControl={
          reasoningControlAvailable && (
            <AuthoringReasoningControl
              value={reasoningEffort}
              onChange={setReasoningEffort}
              disabled={disabled}
            />
          )
        }
        tools={
          <AuthoringToolsPopover
            course={course}
            policy={policy}
            strictSourceMode={strictSourceMode}
            disabled={disabled}
            open={toolsOpen}
            onOpenChange={(open) => {
              setToolsOpen(open);
              if (!open) setSourceSelectionError(null);
            }}
            isUploadingSource={isUploadingSource}
            sourceUploadError={sourceUploadError}
            sourceSelectionError={sourceSelectionError}
            selectedTargetIds={selectedTargetIds}
            selectedBlockIds={selectedBlockIds}
            sources={sources}
            sourceRefreshes={sourceRefreshes}
            onPolicyChange={updatePolicy}
            onStrictSourceModeChange={setStrictSourceMode}
            onUploadSource={uploadSource}
            onSourceUploadError={setSourceUploadError}
            onSelectedTargetIdsChange={setSelectedTargetIds}
            onSelectedBlockIdsChange={setSelectedBlockIds}
            onRefreshSource={onRefreshSource}
          />
        }
        attachments={attachmentChips}
      />
    </div>
  );
};
