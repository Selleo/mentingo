/** Presents proposals, dependency closure, safeguards, and the explicit apply selection. */
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { BoldBulletEditor } from "~/components/RichText/Editor";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { operationLabel, proposalDependencyClosure } from "../courseAuthoring.records";
import {
  COURSE_AUTHORING_FEEDBACK_MAX_LENGTH,
  PROPOSAL_APPLICATION_STATUS,
} from "../review/curriculumReview.constants";

import { AuthoringLivePreview } from "./AuthoringLivePreview";
import { AuthoringOperationPreview } from "./AuthoringOperationPreview";
import { AuthoringRequestHistory } from "./AuthoringRequestHistory";

import type {
  AuthoringOperation,
  AuthoringRequestView,
  AuthoringTask,
  PreviewView,
  ProposalView,
} from "../courseAuthoring.types";
const operationTranslationKeys: Record<string, string> = {
  "lesson.create": "courseAuthoring.review.operationTypes.lessonCreate",
  "lesson.update": "courseAuthoring.review.operationTypes.lessonUpdate",
  "lesson.metadata.update": "courseAuthoring.review.operationTypes.lessonUpdate",
  "lesson.delete": "courseAuthoring.review.operationTypes.lessonDelete",
  "lesson.reorder": "courseAuthoring.review.operationTypes.lessonReorder",
  "chapter.create": "courseAuthoring.review.operationTypes.chapterCreate",
  "chapter.update": "courseAuthoring.review.operationTypes.chapterUpdate",
  "chapter.delete": "courseAuthoring.review.operationTypes.chapterDelete",
  "chapter.reorder": "courseAuthoring.review.operationTypes.chapterReorder",
  "course.lesson.create": "courseAuthoring.review.operationTypes.lessonCreate",
  "course.lesson.update": "courseAuthoring.review.operationTypes.lessonUpdate",
  "course.lesson.delete": "courseAuthoring.review.operationTypes.lessonDelete",
  "course.lesson.reorder": "courseAuthoring.review.operationTypes.lessonReorder",
  "course.chapter.create": "courseAuthoring.review.operationTypes.chapterCreate",
  "course.chapter.update": "courseAuthoring.review.operationTypes.chapterUpdate",
  "course.chapter.delete": "courseAuthoring.review.operationTypes.chapterDelete",
  "course.chapter.reorder": "courseAuthoring.review.operationTypes.chapterReorder",
  "course.metadata.update": "courseAuthoring.review.operationTypes.metadataUpdate",
  "course.settings.update": "courseAuthoring.review.operationTypes.settingsUpdate",
  "course.block.replace": "courseAuthoring.review.operationTypes.blockReplace",
};

const translateOperationType = (t: (key: string) => string, value: string) =>
  t(operationTranslationKeys[value] ?? "courseAuthoring.review.unknownChange");

const translateLessonType = (t: (key: string) => string, value: string) => {
  const keys: Record<string, string> = {
    content: "common.lessonTypes.content",
    quiz: "common.lessonTypes.quiz",
    ai_mentor: "common.lessonTypes.ai_mentor",
  };
  return t(keys[value] ?? "courseAuthoring.review.question");
};

const hasCurriculumChange = (proposal: ProposalView) =>
  proposal.outline !== null ||
  proposal.operations.some(
    (operation) =>
      operation.type !== "course.metadata.update" && operation.type !== "course.settings.update",
  );

/** Renders a safe, operation-specific preview for reviewer inspection. */
const OperationPreview = ({ operation }: { operation: AuthoringOperation }) => {
  const { t } = useTranslation();
  const payload = operation.payload;
  const lessonType = typeof payload.lessonType === "string" ? payload.lessonType : null;

  if (lessonType === "content" || lessonType === "quiz" || lessonType === "ai_mentor") {
    return <AuthoringOperationPreview operation={operation} />;
  }

  if (operation.type === "course.settings.update") {
    const impacts = [
      "lessonSequenceEnabled" in payload
        ? t("courseAuthoring.review.impacts.lessonSequence")
        : null,
      "videoCompletionTrackingEnabled" in payload
        ? t("courseAuthoring.review.impacts.videoCompletion")
        : null,
      "certificateValidity" in payload
        ? t("courseAuthoring.review.impacts.certificateValidity")
        : null,
      payload.applyValidityToExistingCertificates === true
        ? t("courseAuthoring.review.impacts.existingCertificates")
        : null,
    ].filter((impact): impact is string => Boolean(impact));
    return (
      <ul className="mt-2 space-y-1 rounded-md bg-warning-50 p-2 text-xs text-warning-950">
        {impacts.map((impact) => (
          <li key={impact}>• {impact}</li>
        ))}
      </ul>
    );
  }

  const summary = operationLabel(operation);
  const fallback = operation.type.replaceAll(".", " ");
  return (
    <p className="mt-1 text-sm text-neutral-900">
      {summary === fallback ? translateOperationType(t, operation.type) : summary}
    </p>
  );
};

type Props = {
  compact?: boolean;
  showRequests?: boolean;
  requests?: AuthoringRequestView[];
  tasks?: AuthoringTask[];
  proposals: ProposalView[];
  previews?: PreviewView[];
  onPreviewInCurriculum?: (preview: PreviewView) => void;
  onPreviewProposal?: (proposal: ProposalView) => void;
  busy?: boolean;
  onAccept: (proposal: ProposalView) => void | Promise<void>;
  onReject: (proposal: ProposalView) => void;
  onRegenerate: (proposal: ProposalView, feedback?: string) => void | Promise<void>;
  onApply: (
    proposalIds: string[],
    acknowledgeAssessmentChanges: boolean,
    omitOptionalAssetIds: string[],
  ) => void | Promise<void>;
  onRetryApply?: () => void;
  applyState?:
    | "idle"
    | "preparing"
    | "synchronizing"
    | "applying"
    | "applied"
    | "conflict"
    | "failed";
  attemptedTargetIds?: string[];
  readyAssetIds?: string[];
  omittedOptionalAssetIds?: string[];
  onOmittedOptionalAssetIdsChange?: (assetIds: string[]) => void;
  selectedProposalIds?: string[];
  onSelectedProposalIdsChange?: (proposalIds: string[]) => void;
  targetLabelById?: Record<string, string>;
  applicationStatusByProposalId?: Record<string, ProposalApplicationStatus>;
  renderCards?: boolean;
  autoApplyReadyContent?: boolean;
};

export { PROPOSAL_APPLICATION_STATUS };

export type ProposalApplicationStatus =
  (typeof PROPOSAL_APPLICATION_STATUS)[keyof typeof PROPOSAL_APPLICATION_STATUS];

/** Expands proposal details in place so review remains in conversation order. */
const ProposalDetails = ({ open, children }: { open: boolean; children: ReactNode }) =>
  open && <div>{children}</div>;

/** Keeps a safe receipt retry close to the one proposal it can affect. */
const ProposalApplicationRetry = ({
  label,
  disabled,
  onRetry,
}: {
  label: string;
  disabled?: boolean;
  onRetry: () => void;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={label}
          disabled={disabled}
          onClick={onRetry}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** Renders a read-only proposal preview with decision and dependency controls. */
export const ProposalCard = ({
  compact = false,
  grouped = false,
  proposal,
  selected,
  disabled,
  onSelectedChange,
  onAccept,
  onReject,
  onRegenerate,
  targetLabelById,
  applicationStatus,
  showSelection = true,
  onPreviewProposal,
  onRetryApply,
  retryDisabled,
  initiallyExpanded,
  forceExpanded = false,
  selectionDisabled = false,
  selectionRequired = false,
  allowPendingSelection = false,
  showDecisionActions = true,
}: {
  compact?: boolean;
  grouped?: boolean;
  proposal: ProposalView;
  selected: boolean;
  disabled?: boolean;
  onSelectedChange: (selected: boolean) => void;
  onAccept: () => void | Promise<void>;
  onReject: () => void;
  onRegenerate: (feedback?: string) => void | Promise<void>;
  targetLabelById?: Record<string, string>;
  applicationStatus?: ProposalApplicationStatus;
  showSelection?: boolean;
  onPreviewProposal?: (proposal: ProposalView) => void;
  onRetryApply?: () => void;
  retryDisabled?: boolean;
  initiallyExpanded?: boolean;
  forceExpanded?: boolean;
  selectionDisabled?: boolean;
  selectionRequired?: boolean;
  allowPendingSelection?: boolean;
  showDecisionActions?: boolean;
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(
    initiallyExpanded ?? (!compact && proposal.decision === "pending"),
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const { control, handleSubmit, reset } = useForm<{ feedback: string }>({
    defaultValues: { feedback: "" },
  });
  const clearFeedback = () => {
    reset({ feedback: "" });
    setFeedbackText("");
  };
  const decision = proposal.decision;
  const titleChange = proposal.operations.find(
    (operation) =>
      operation.type === "course.metadata.update" && typeof operation.payload.title === "string",
  );
  const currentTitle = titleChange ? targetLabelById?.[titleChange.targetId] : undefined;
  const proposedTitle = titleChange?.payload.title;
  const detailOperations = proposal.operations.filter(
    (operation) => operation.operationId !== titleChange?.operationId,
  );
  const decisionStatus = applicationStatus ?? (decision === "applied" ? "applied" : null);
  const isPending = decision === "pending" && decisionStatus !== "applied";
  const reviewStatus = decisionStatus ?? decision;
  const statusDotClass = match(reviewStatus)
    .with("accepted", "applied", () => "bg-success-600")
    .with("rejected", "failed", "conflict", () => "bg-destructive")
    .otherwise(() => "bg-warning-500");
  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);
  const decide = (action: () => void | Promise<void>) => {
    try {
      void Promise.resolve(action()).catch(() => undefined);
    } catch {
      /* The command owner reports failures. */
    }
  };
  const submitFeedback = handleSubmit(async () => {
    const feedback = feedbackText.trim();
    if (
      !feedback ||
      feedbackText.length > COURSE_AUTHORING_FEEDBACK_MAX_LENGTH ||
      disabled ||
      feedbackSubmitting
    )
      return;
    setFeedbackSubmitting(true);
    try {
      await onRegenerate(feedback);
      clearFeedback();
      setFeedbackOpen(false);
    } catch {
      // The command owner reports the error; keep the feedback available for retry.
    } finally {
      setFeedbackSubmitting(false);
    }
  });
  const handleFeedbackOpenChange = (open: boolean) => {
    if (!open) {
      if (disabled || feedbackSubmitting) return;
      clearFeedback();
    }
    setFeedbackOpen(open);
  };
  const feedbackControls = isPending && (
    <Dialog open={feedbackOpen} onOpenChange={handleFeedbackOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-neutral-600"
          disabled={disabled || feedbackSubmitting}
        >
          {t("courseAuthoring.review.askForChanges")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        noCloseButton={disabled || feedbackSubmitting}
      >
        <DialogHeader>
          <DialogTitle>{t("courseAuthoring.review.askForChanges")}</DialogTitle>
          <DialogDescription>
            {t("courseAuthoring.review.changeFeedbackPlaceholder")}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submitFeedback(event)}>
          <Controller
            control={control}
            name="feedback"
            rules={{
              validate: () =>
                Boolean(feedbackText.trim()) &&
                feedbackText.length <= COURSE_AUTHORING_FEEDBACK_MAX_LENGTH,
            }}
            render={({ field }) => (
              <BoldBulletEditor
                id={`proposal-feedback-${proposal.id}`}
                content={field.value ?? ""}
                onChange={field.onChange}
                onTextChange={setFeedbackText}
                onBlur={() => field.onBlur()}
                ariaLabel={t("courseAuthoring.review.changeFeedbackLabel")}
                placeholder={t("courseAuthoring.review.changeFeedbackPlaceholder")}
                editable={!disabled && !feedbackSubmitting}
                contentClassName="min-h-0 max-h-40 overflow-y-auto sm:max-h-48"
                editorClassName="min-h-24 p-3"
              />
            )}
          />
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-neutral-500">
              {t("courseAuthoring.review.feedbackCount", {
                count: feedbackText.length,
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || feedbackSubmitting}
                onClick={() => {
                  clearFeedback();
                  setFeedbackOpen(false);
                }}
              >
                {t("courseAuthoring.review.cancelFeedback")}
              </Button>
              <Button
                type="submit"
                size="sm"
                className="gap-2"
                disabled={
                  disabled ||
                  feedbackSubmitting ||
                  !feedbackText.trim() ||
                  feedbackText.length > COURSE_AUTHORING_FEEDBACK_MAX_LENGTH
                }
              >
                {feedbackSubmitting && (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                )}
                {t("courseAuthoring.review.sendFeedback")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <article
        className={cn(
          "overflow-hidden bg-white",
          grouped ? "rounded-none" : "rounded-xl border border-neutral-200",
        )}
        data-testid={`course-authoring-proposal-${proposal.id}`}
      >
        <div className="flex items-start gap-3 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
          {grouped && showSelection && (
            <Checkbox
              aria-label={t("courseAuthoring.review.selectProposal", { title: proposal.summary })}
              className="mt-1.5 shrink-0"
              checked={selected}
              disabled={selectionDisabled || disabled}
              onCheckedChange={(checked) => onSelectedChange(checked === true)}
            />
          )}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="group w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              <span className="flex items-start gap-3">
                <span className="min-w-0 flex-1 text-base font-semibold leading-6 text-neutral-950">
                  {proposal.summary}
                </span>
                {expanded ? (
                  <ChevronDown className="mt-1 size-4 shrink-0 text-neutral-500 group-hover:text-primary-700" />
                ) : (
                  <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-500 group-hover:text-primary-700" />
                )}
              </span>
            </button>
            {typeof proposedTitle === "string" && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5">
                {currentTitle && (
                  <>
                    <span className="max-w-full text-neutral-500 line-through">{currentTitle}</span>
                    <ArrowRight className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  </>
                )}
                <span className="font-medium text-neutral-900">{proposedTitle}</span>
              </div>
            )}
            {!titleChange && proposal.operations.length > 0 && (
              <p className="mt-1.5 text-sm leading-5 text-neutral-600">
                {proposal.operations.length === 1
                  ? translateOperationType(t, proposal.operations[0].type)
                  : t("courseAuthoring.review.changes", { count: proposal.operations.length })}
                {proposal.operations.length === 1 &&
                  targetLabelById?.[proposal.operations[0].targetId] && (
                    <span> · {targetLabelById[proposal.operations[0].targetId]}</span>
                  )}
              </p>
            )}
            {grouped && selectionRequired && (
              <p className="mt-2 text-xs font-medium text-primary-700">
                {t("courseAuthoring.review.requiredForSelection")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-neutral-600">
              <span className={cn("size-2 rounded-full", statusDotClass)} aria-hidden="true" />
              {decisionStatus
                ? t(`courseAuthoring.review.applyState.${decisionStatus}`)
                : t(`courseAuthoring.review.decision.${decision}`)}
            </span>
            {onRetryApply && (
              <ProposalApplicationRetry
                label={t("courseAuthoring.review.retryApply")}
                disabled={retryDisabled}
                onRetry={onRetryApply}
              />
            )}
          </div>
        </div>
        {grouped && (
          <ProposalDetails open={expanded}>
            <div className="space-y-4 border-t border-neutral-100 bg-neutral-50/50 px-4 py-4 sm:px-5">
              {proposal.rationale && (
                <p className="max-w-prose text-sm leading-6 text-neutral-700">
                  {proposal.rationale}
                </p>
              )}
              {proposal.warnings.length > 0 && (
                <ul className="space-y-1 border-l-2 border-warning-400 pl-3 text-xs leading-5 text-neutral-700">
                  {proposal.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              {detailOperations.length > 0 && (
                <div className="space-y-2">
                  {detailOperations.map((operation) => (
                    <div
                      key={operation.operationId}
                      className="rounded-lg border border-neutral-200 bg-white px-3.5 py-3"
                    >
                      <p className="text-sm font-medium text-neutral-900">
                        {translateOperationType(t, operation.type)}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {targetLabelById?.[operation.targetId] ??
                          t("courseAuthoring.review.targetFallback", {
                            id: operation.targetId.slice(0, 8),
                          })}
                      </p>
                      <OperationPreview operation={operation} />
                    </div>
                  ))}
                </div>
              )}
              {feedbackControls}
            </div>
          </ProposalDetails>
        )}
        {grouped &&
          ((onPreviewProposal && hasCurriculumChange(proposal) && isPending) ||
            (isPending && showDecisionActions)) && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 sm:px-5">
                {onPreviewProposal && hasCurriculumChange(proposal) && isPending ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 gap-2 px-2 text-primary-700"
                    disabled={disabled}
                    onClick={() => onPreviewProposal(proposal)}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    {t("courseAuthoring.livePreview.previewInCurriculum")}
                  </Button>
                ) : (
                  <span />
                )}
                {isPending && showDecisionActions && (
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-w-24 px-4"
                      disabled={disabled}
                      onClick={() => decide(onReject)}
                    >
                      {t("courseAuthoring.review.reject")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="min-w-32 px-4"
                      disabled={disabled}
                      onClick={() => decide(onAccept)}
                    >
                      {t(
                        proposal.operations.length > 0
                          ? "courseAuthoring.review.applyProposal"
                          : "courseAuthoring.review.accept",
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        {!grouped && (
          <div className="space-y-2 p-3 pt-0">
            {expanded && proposal.operations.length > 0 && (
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                {proposal.operations.map((operation) => (
                  <div key={operation.operationId}>
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {translateOperationType(t, operation.type)}
                      <span className="normal-case tracking-normal">
                        {" · "}
                        {targetLabelById?.[operation.targetId] ??
                          t("courseAuthoring.review.targetFallback", {
                            id: operation.targetId.slice(0, 8),
                          })}
                      </span>
                    </p>
                    <OperationPreview operation={operation} />
                  </div>
                ))}
              </div>
            )}
            {onPreviewProposal && proposal.operations.length > 0 && isPending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={disabled}
                onClick={() => onPreviewProposal(proposal)}
              >
                <Eye className="size-3.5" aria-hidden="true" />
                {t("courseAuthoring.livePreview.previewInCurriculum")}
              </Button>
            )}
            {feedbackControls}
            {decisionStatus === "conflict" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={retryDisabled}
                onClick={() => onRegenerate()}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t("courseAuthoring.review.refreshItem")}
              </Button>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-start gap-3 p-3">
        {showSelection &&
          (!compact || proposal.decision === "accepted" || allowPendingSelection) && (
            <Checkbox
              aria-label={t("courseAuthoring.review.selectProposal", { title: proposal.summary })}
              className="mt-1"
              checked={selected}
              disabled={
                selectionDisabled ||
                disabled ||
                (proposal.decision !== "accepted" && !allowPendingSelection)
              }
              onCheckedChange={(checked) => onSelectedChange(checked === true)}
            />
          )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-neutral-950">
                  {proposal.summary}
                </span>
                {!compact && (
                  <span className="mt-1 block text-xs leading-5 text-neutral-600">
                    {proposal.rationale ||
                      t("courseAuthoring.review.structuredChangesReady", {
                        count: proposal.operations.length,
                      })}
                  </span>
                )}
              </span>
              {expanded ? (
                <ChevronDown className="mt-1 size-4 shrink-0 text-neutral-500" />
              ) : (
                <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-500" />
              )}
            </span>
            {compact && !expanded && (
              <span className="mt-2 block text-sm font-medium text-primary-700">
                {t("courseAuthoring.conversation.review")}
              </span>
            )}
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant={match(decisionStatus ?? decision)
                .with("accepted", () => "success" as const)
                .with("applied", () => "success" as const)
                .with("rejected", () => "blocked" as const)
                .with("failed", () => "blocked" as const)
                .with("conflict", () => "blocked" as const)
                .otherwise(() => "inProgress" as const)}
              className="text-xs"
            >
              {decisionStatus
                ? t(`courseAuthoring.review.applyState.${decisionStatus}`)
                : t(`courseAuthoring.review.decision.${decision}`)}
            </Badge>
            {onRetryApply && (
              <ProposalApplicationRetry
                label={t("courseAuthoring.review.retryApply")}
                disabled={retryDisabled}
                onRetry={onRetryApply}
              />
            )}
            {!compact && proposal.evidenceCount > 0 && (
              <Badge variant="notStarted" className="text-xs">
                {t("courseAuthoring.review.sources", { count: proposal.evidenceCount })}
              </Badge>
            )}
            {!compact && proposal.operations.length > 0 && (
              <Badge variant="notStarted" className="text-xs">
                {t("courseAuthoring.review.changes", { count: proposal.operations.length })}
              </Badge>
            )}
            {!compact && (proposal.manual || proposal.parentProposalId) && (
              <Badge variant="secondaryWithOutline" className="text-xs">
                {t("courseAuthoring.review.editedDraft")}
              </Badge>
            )}
            {!compact && proposal.protectedEdits.length > 0 && (
              <Badge variant="secondaryWithOutline" className="text-xs">
                {t("courseAuthoring.review.preservedEdits", {
                  count: proposal.protectedEdits.length,
                })}
              </Badge>
            )}
            {selectionRequired && (
              <Badge variant="secondaryWithOutline" className="text-xs">
                {t("courseAuthoring.review.requiredForSelection")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <ProposalDetails open={expanded}>
        <div className="border-t border-neutral-100 bg-neutral-50/60 p-4">
          {compact && proposal.rationale && (
            <p className="mb-3 text-sm text-neutral-600">{proposal.rationale}</p>
          )}
          {proposal.warnings.length > 0 && (
            <div className="mb-3 border-l-2 border-warning-400 pl-3 text-xs leading-5 text-neutral-700">
              <ul className="space-y-1">
                {proposal.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {proposal.outline && (
            <div className="mb-3 rounded-lg border border-primary-100 bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-800">
                <ShieldCheck className="size-4" />
                {t("courseAuthoring.review.proposedOutlineApproval")}
              </div>
              <ol className="space-y-2">
                {proposal.outline.map((chapter, chapterIndex) => (
                  <li key={chapter.id} className="text-sm">
                    <span className="font-medium">
                      {chapterIndex + 1}. {chapter.title}
                    </span>
                    <ul className="ml-5 mt-1 list-disc text-xs text-neutral-600">
                      {chapter.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          {lesson.title} · {translateLessonType(t, lesson.lessonType)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {proposal.operations.length > 0 && (
            <div className="space-y-2">
              {proposal.operations.map((operation) => (
                <div
                  key={operation.operationId}
                  className="rounded-lg border border-neutral-200 bg-white p-3"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {translateOperationType(t, operation.type)}
                    <span className="normal-case tracking-normal">
                      {" · "}
                      {targetLabelById?.[operation.targetId] ??
                        t("courseAuthoring.review.targetFallback", {
                          id: operation.targetId.slice(0, 8),
                        })}
                    </span>
                  </p>
                  <OperationPreview operation={operation} />
                </div>
              ))}
            </div>
          )}
          {(decisionStatus === "failed" || decisionStatus === "conflict") && (
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-destructive">
              <span>{t(`courseAuthoring.review.applyState.${decisionStatus}`)}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={decisionStatus === "conflict" ? retryDisabled : disabled}
                onClick={() => onRegenerate()}
              >
                {t("courseAuthoring.review.refreshItem")}
              </Button>
            </div>
          )}
          {isPending && showDecisionActions && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={disabled}
                onClick={() => decide(onAccept)}
              >
                <Check className="size-4" />{" "}
                {t(
                  proposal.operations.length > 0
                    ? "courseAuthoring.review.applyProposal"
                    : "courseAuthoring.review.accept",
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={disabled}
                onClick={() => decide(onReject)}
              >
                <X className="size-4" /> {t("courseAuthoring.review.reject")}
              </Button>
            </div>
          )}
          {feedbackControls}
        </div>
      </ProposalDetails>
    </article>
  );
};

/** Coordinates proposal selection, safety acknowledgements, and explicit apply. */
export const ProposalReview = ({
  compact = false,
  showRequests = true,
  requests = [],
  tasks = [],
  proposals,
  previews = [],
  onPreviewInCurriculum,
  onPreviewProposal,
  busy,
  onAccept,
  onReject,
  onRegenerate,
  onApply,
  onRetryApply,
  applyState = "idle",
  attemptedTargetIds = [],
  readyAssetIds = [],
  omittedOptionalAssetIds,
  onOmittedOptionalAssetIdsChange,
  selectedProposalIds,
  onSelectedProposalIdsChange,
  targetLabelById = {},
  applicationStatusByProposalId = {},
  renderCards = true,
  autoApplyReadyContent = false,
}: Props) => {
  const { t } = useTranslation();
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const selected = selectedProposalIds ?? localSelected;
  const [assessmentConfirmationOpen, setAssessmentConfirmationOpen] = useState(false);
  const [applyingSelection, setApplyingSelection] = useState(false);
  const [localOmittedOptionalAssetIds, setLocalOmittedOptionalAssetIds] = useState<string[]>([]);
  const effectiveOmittedOptionalAssetIds = omittedOptionalAssetIds ?? localOmittedOptionalAssetIds;
  const updateOmittedOptionalAssetIds =
    onOmittedOptionalAssetIdsChange ?? setLocalOmittedOptionalAssetIds;
  useEffect(() => {
    const acceptedIds = new Set(
      proposals
        .filter((item) => item.decision === "accepted" && item.operations.length > 0)
        .map((item) => item.id),
    );
    const next = selected.filter((id) => acceptedIds.has(id));
    if (next.length === selected.length) return;
    onSelectedProposalIdsChange?.(next);
    if (!selectedProposalIds) setLocalSelected(next);
  }, [onSelectedProposalIdsChange, proposals, selected, selectedProposalIds]);

  const updateSelected = (update: (current: string[]) => string[]) => {
    const next = update(selected);
    onSelectedProposalIdsChange?.(next);
    if (!selectedProposalIds) setLocalSelected(next);
  };

  const selectedForApply = selected.filter(
    (proposalId) =>
      applicationStatusByProposalId[proposalId] !== "applied" &&
      proposals.some(
        (proposal) =>
          proposal.id === proposalId &&
          proposal.decision !== "applied" &&
          proposal.operations.length > 0,
      ),
  );
  const closure = useMemo(
    () => proposalDependencyClosure(selectedForApply, proposals),
    [proposals, selectedForApply],
  );
  const selectedAssets = useMemo(
    () =>
      proposals
        .filter((proposal) => selectedForApply.includes(proposal.id))
        .flatMap((proposal) => proposal.assetRequests ?? [])
        .filter(
          (asset, index, assets) =>
            assets.findIndex((candidate) => candidate.assetId === asset.assetId) === index,
        ),
    [proposals, selectedForApply],
  );
  const readyAssets = useMemo(() => new Set(readyAssetIds), [readyAssetIds]);
  const pendingRequiredAssets = selectedAssets.filter(
    (asset) => asset.required && !readyAssets.has(asset.assetId),
  );
  const pendingOptionalAssets = selectedAssets.filter(
    (asset) =>
      !asset.required &&
      !readyAssets.has(asset.assetId) &&
      !effectiveOmittedOptionalAssetIds.includes(asset.assetId),
  );
  const selectedAssetIds = useMemo(
    () => new Set(selectedAssets.map((asset) => asset.assetId)),
    [selectedAssets],
  );
  const hasAssessmentImpact = useMemo(
    () =>
      proposals
        .filter((proposal) => selectedForApply.includes(proposal.id))
        .flatMap((proposal) => proposal.operations)
        .some(
          (operation) =>
            attemptedTargetIds.includes(operation.targetId) &&
            ["lesson.update", "lesson.delete", "chapter.delete"].includes(operation.type),
        ),
    [attemptedTargetIds, proposals, selectedForApply],
  );
  const canApply =
    selectedForApply.length > 0 &&
    closure.missingDependencies.length === 0 &&
    pendingRequiredAssets.length === 0 &&
    pendingOptionalAssets.length === 0 &&
    applyState === "idle";

  const selectedOmittedOptionalAssetIds = effectiveOmittedOptionalAssetIds.filter((assetId) =>
    selectedAssetIds.has(assetId),
  );
  const confirmAssessedChange = async () => {
    if (!canApply || busy || applyingSelection) return;
    setApplyingSelection(true);
    try {
      await onApply(closure.ids, true, selectedOmittedOptionalAssetIds);
      setAssessmentConfirmationOpen(false);
    } catch {
      // The command owner reports the failure; keep the confirmation available for retry.
    } finally {
      setApplyingSelection(false);
    }
  };

  if (proposals.length === 0 && previews.length === 0 && requests.length === 0) return null;

  /** Keeps provisional output beside its originating request without enabling application. */
  const renderPreview = (preview: PreviewView) => (
    <AuthoringLivePreview
      key={preview.taskId}
      preview={preview}
      onPreviewInCurriculum={
        onPreviewInCurriculum ? () => onPreviewInCurriculum(preview) : undefined
      }
    />
  );
  /** Shares selection and dependency checks across every conversation turn. */
  const renderProposal = (proposal: ProposalView) => {
    const applicationStatus = applicationStatusByProposalId[proposal.id];
    const canRetryApplication =
      (applicationStatus === "failed" || applicationStatus === "synchronizing") &&
      onRetryApply !== undefined;
    return (
      <ProposalCard
        compact={compact}
        key={proposal.id}
        proposal={proposal}
        selected={selected.includes(proposal.id)}
        showSelection={!autoApplyReadyContent}
        disabled={busy || applyState !== "idle"}
        onSelectedChange={(checked) =>
          updateSelected((current) =>
            checked ? [...current, proposal.id] : current.filter((id) => id !== proposal.id),
          )
        }
        onAccept={() => onAccept(proposal)}
        onReject={() => onReject(proposal)}
        onRegenerate={(feedback) =>
          feedback ? onRegenerate(proposal, feedback) : onRegenerate(proposal)
        }
        targetLabelById={targetLabelById}
        applicationStatus={applicationStatus}
        onPreviewProposal={onPreviewProposal}
        onRetryApply={canRetryApplication ? onRetryApply : undefined}
        retryDisabled={busy}
      />
    );
  };
  const requestByTask = new Map(tasks.map((task) => [task.taskId, task.requestId]));
  const knownRequests = new Set(requests.map((request) => request.requestId));
  /** Keeps legacy results visible when their request is absent from the snapshot. */
  const isUnassociated = (taskId: string | null) =>
    !taskId || !knownRequests.has(requestByTask.get(taskId) ?? "");
  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <section key={request.id} className="space-y-3">
          {showRequests && <AuthoringRequestHistory requests={[request]} />}
          {previews
            .filter((preview) => requestByTask.get(preview.taskId) === request.requestId)
            .map(renderPreview)}
          {proposals
            .filter(
              (proposal) =>
                proposal.taskId && requestByTask.get(proposal.taskId) === request.requestId,
            )
            .filter(() => renderCards)
            .map(renderProposal)}
        </section>
      ))}
      {renderCards &&
        previews.filter((preview) => isUnassociated(preview.taskId)).map(renderPreview)}
      {renderCards &&
        proposals.filter((proposal) => isUnassociated(proposal.taskId)).map(renderProposal)}
      {selectedAssets.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t("courseAuthoring.review.visualAssets")}</h2>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                {t("courseAuthoring.review.visualAssetsDescription")}
              </p>
            </div>
            <Badge variant={pendingRequiredAssets.length ? "blocked" : "notStarted"}>
              {t("courseAuthoring.review.selected", { count: selectedAssets.length })}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {selectedAssets.map((asset) => {
              const ready = readyAssets.has(asset.assetId);
              const omitted = effectiveOmittedOptionalAssetIds.includes(asset.assetId);
              return (
                <div
                  key={asset.assetId}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{asset.altText}</p>
                        <Badge
                          variant={asset.required ? "blocked" : "secondaryWithOutline"}
                          className="text-[10px]"
                        >
                          {asset.required
                            ? t("courseAuthoring.activityRail.required")
                            : t("courseAuthoring.activityRail.optional")}
                        </Badge>
                        <Badge
                          variant={ready ? "success" : omitted ? "notStarted" : "inProgress"}
                          className="text-[10px]"
                        >
                          {ready
                            ? t("courseAuthoring.review.ready")
                            : omitted
                              ? t("courseAuthoring.review.omitted")
                              : t("courseAuthoring.review.waiting")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        {t("courseAuthoring.review.purpose", {
                          value: t(`courseAuthoring.review.purposes.${asset.purpose}`, {
                            defaultValue: t("courseAuthoring.review.unknownPurpose"),
                          }),
                        })}
                      </p>
                      <p className="mt-2 text-xs text-neutral-700">
                        {t("courseAuthoring.activityRail.generatedVisual", {
                          content: asset.source.content,
                        })}
                      </p>
                    </div>
                    {!asset.required && (
                      <div className="flex shrink-0 items-start gap-2 text-xs text-neutral-700">
                        <Checkbox
                          aria-label={t("courseAuthoring.review.omitOptionalAsset", {
                            title: asset.altText,
                          })}
                          checked={omitted}
                          onCheckedChange={(checked) =>
                            updateOmittedOptionalAssetIds(
                              checked === true
                                ? [...new Set([...effectiveOmittedOptionalAssetIds, asset.assetId])]
                                : effectiveOmittedOptionalAssetIds.filter(
                                    (id) => id !== asset.assetId,
                                  ),
                            )
                          }
                        />
                        <span>{t("courseAuthoring.review.omit")}</span>
                      </div>
                    )}
                  </div>
                  {!ready && !omitted && (
                    <p
                      className={cn(
                        "mt-2 text-xs",
                        asset.required ? "text-destructive" : "text-warning-800",
                      )}
                    >
                      {asset.required
                        ? t("courseAuthoring.review.requiredAssetNotReady")
                        : t("courseAuthoring.review.optionalAssetOmitHint")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {renderCards && !autoApplyReadyContent && selectedForApply.length > 0 && (
        <Dialog
          open={assessmentConfirmationOpen}
          onOpenChange={(open) => {
            if (!open && (busy || applyingSelection)) return;
            setAssessmentConfirmationOpen(open);
          }}
        >
          <div className="sticky bottom-4 z-10 rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                {!autoApplyReadyContent && (
                  <p className="text-sm font-semibold">
                    {t("courseAuthoring.review.acceptedDraftsSelected", {
                      count: selectedForApply.length,
                    })}
                  </p>
                )}
                {closure.missingDependencies.length > 0 && (
                  <p className="text-xs text-destructive">
                    {t("courseAuthoring.review.missingDependencies", {
                      count: closure.missingDependencies.length,
                    })}
                  </p>
                )}
              </div>
              {hasAssessmentImpact ? (
                <DialogTrigger asChild>
                  <Button type="button" disabled={!canApply || busy || applyingSelection}>
                    {applyState === "idle"
                      ? t("courseAuthoring.review.applySelected")
                      : `${t(`courseAuthoring.review.applyState.${applyState}`)}…`}
                  </Button>
                </DialogTrigger>
              ) : (
                <Button
                  type="button"
                  disabled={!canApply || busy || applyingSelection}
                  onClick={() => void onApply(closure.ids, false, selectedOmittedOptionalAssetIds)}
                >
                  {applyState === "idle"
                    ? t("courseAuthoring.review.applySelected")
                    : `${t(`courseAuthoring.review.applyState.${applyState}`)}…`}
                </Button>
              )}
            </div>
          </div>
          <DialogContent
            className="max-h-[90dvh] overflow-y-auto"
            noCloseButton={busy || applyingSelection}
          >
            <DialogHeader>
              <DialogTitle>{t("courseAuthoring.review.assessmentImpactTitle")}</DialogTitle>
              <DialogDescription>
                {t("courseAuthoring.review.assessmentImpactBody")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || applyingSelection}
                onClick={() => setAssessmentConfirmationOpen(false)}
              >
                {t("common.button.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!canApply || busy || applyingSelection}
                onClick={() => void confirmAssessedChange()}
              >
                {applyingSelection && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                {t("courseAuthoring.review.applySelected")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
