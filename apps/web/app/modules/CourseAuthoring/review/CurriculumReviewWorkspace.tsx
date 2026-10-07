import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useAuthoringAssetPreviewUrls } from "~/api/queries/useAuthoringAssetPreviewUrls";
import { BoldBulletEditor } from "~/components/RichText/Editor";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useToast } from "~/components/ui/use-toast";
import { renderReviewNativeForm } from "~/modules/Admin/EditCourse/CourseLessons/components/ReviewNativeForm";

import { CURRICULUM_HANDLES } from "../../../../e2e/data/curriculum/handles";

import { buildCurriculumReview, reviewNodeKey } from "./buildCurriculumReview";
import {
  AUTHORING_OPERATION_TYPE,
  COURSE_AUTHORING_FEEDBACK_MAX_LENGTH,
  CURRICULUM_PREVIEW_STATUS,
  PROPOSAL_DECISION,
  REVIEW_NODE_TYPE,
  REVIEW_SHORTCUT,
} from "./curriculumReview.constants";
import { CurriculumReviewBar } from "./CurriculumReviewBar";
import { ReviewChangeDetail } from "./ReviewChangeDetail";
import { ReviewCurriculumList } from "./ReviewCurriculumList";
import {
  acceptProposals,
  decisionSummary,
  initialDecisions,
  rejectProposals,
} from "./reviewDecisions";

import type { ReviewNode } from "./curriculumReview.types";
import type { StagedDecisions } from "./reviewDecisions";
import type { CurriculumPreview, CurriculumPreviewActions } from "../courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";
import type { Chapter } from "~/modules/Admin/EditCourse/EditCourse.types";

const NO_READY_ASSET_IDS: string[] = [];
const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
};

type Props = {
  chapters: Chapter[];
  preview: CurriculumPreview;
  actions: CurriculumPreviewActions | null;
  courseId?: string;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  onExit: () => void;
  onApplied: () => void;
};

const reviewCardTestId = (key: string) => {
  const [nodeType, id = ""] = key.split(/:(.+)/);
  return match(nodeType)
    .with(REVIEW_NODE_TYPE.LESSON, () => CURRICULUM_HANDLES.lessonCard(id))
    .with(REVIEW_NODE_TYPE.CHAPTER, () => CURRICULUM_HANDLES.chapterCard(id))
    .otherwise(() => "course-authoring-review-course");
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const CurriculumReviewWorkspace = ({
  chapters,
  preview,
  actions,
  courseId,
  language,
  baseLanguage,
  onExit,
  onApplied,
}: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const proposals = useMemo(() => preview.proposals ?? [], [preview.proposals]);
  const outlineOnly =
    preview.outline.length > 0 &&
    proposals.length > 0 &&
    proposals.every((proposal) => proposal.operationIds.length === 0);
  const assetSourceHtml = useMemo(
    () =>
      (preview.operations ?? [])
        .flatMap((operation) => collectStrings(operation.payload))
        .join("\n"),
    [preview.operations],
  );
  const {
    urls: assetPreviewUrls,
    failedAssetIds,
    retryFailedPreviews,
    isRetrying: retryingPreviews,
  } = useAuthoringAssetPreviewUrls({
    courseId: courseId ?? "",
    sessionId: preview.authoringSessionId,
    html: assetSourceHtml,
    readyAssetIds: preview.readyAssetIds ?? NO_READY_ASSET_IDS,
  });
  const model = useMemo(
    () =>
      buildCurriculumReview({
        chapters,
        preview,
        proposals,
        courseTitle: preview.courseTitle,
        courseId,
      }),
    [chapters, courseId, preview, proposals],
  );
  const streaming = preview.status === CURRICULUM_PREVIEW_STATUS.STREAMING;
  const readOnly = streaming || !actions?.applyReview || proposals.length === 0;
  const [decisions, setDecisions] = useState<StagedDecisions>(() => initialDecisions(proposals));
  const [changesOnly, setChangesOnly] = useState(false);
  const [assessmentConfirmationOpen, setAssessmentConfirmationOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [submittingRefinements, setSubmittingRefinements] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const { control, handleSubmit, reset } = useForm<{ feedback: string }>({
    defaultValues: { feedback: "" },
  });
  const clearFeedback = () => {
    reset({ feedback: "" });
    setFeedbackText("");
  };
  const firstFocusKey = useMemo(() => {
    const focused = preview.focusProposalId
      ? model.changes.find((change) =>
          change.node.proposalIds.includes(preview.focusProposalId ?? ""),
        )
      : undefined;
    return (focused ?? model.changes[0])?.key ?? null;
  }, [model.changes, preview.focusProposalId]);
  const [selectedKey, setSelectedKey] = useState<string | null>(firstFocusKey);
  const detailRef = useRef<HTMLDivElement>(null);

  const proposalKey = proposals.map((proposal) => `${proposal.id}:${proposal.decision}`).join("|");
  useEffect(() => {
    setDecisions((current) => {
      const next = initialDecisions(proposals);
      Object.entries(current).forEach(([id, verdict]) => {
        const proposal = proposals.find((item) => item.id === id);
        if (proposal && proposal.decision === PROPOSAL_DECISION.PENDING) next[id] = verdict;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on proposal identity and decision
  }, [proposalKey]);
  const nodeByKey = useMemo(() => {
    const entries = new Map<string, ReviewNode>();
    if (model.course) entries.set(reviewNodeKey(model.course), model.course);
    model.chapters.forEach((chapter) => {
      entries.set(reviewNodeKey(chapter), chapter);
      chapter.lessons.forEach((lesson) => entries.set(reviewNodeKey(lesson), lesson));
    });
    return entries;
  }, [model]);

  useEffect(() => {
    if (selectedKey && nodeByKey.has(selectedKey)) return;
    setSelectedKey(firstFocusKey);
  }, [firstFocusKey, nodeByKey, selectedKey]);

  const selectedNode = selectedKey ? (nodeByKey.get(selectedKey) ?? null) : null;
  const changeIndex = model.changes.findIndex((change) => change.key === selectedKey);
  const nativeForm = useMemo(
    () =>
      selectedNode
        ? renderReviewNativeForm(
            selectedNode,
            language,
            baseLanguage,
            model.chapters.findIndex((chapter) => chapter.id === selectedNode.id) + 1 || undefined,
            {
              sources: preview.sources ?? [],
              assetPreviewUrls,
              targetedMentorOperationIds: preview.targetedMentorOperationIds,
            },
          )
        : null,
    [
      assetPreviewUrls,
      baseLanguage,
      language,
      model.chapters,
      preview.sources,
      preview.targetedMentorOperationIds,
      selectedNode,
    ],
  );

  const select = useCallback((key: string) => {
    setSelectedKey(key);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-testid="${CSS.escape(reviewCardTestId(key))}"]`)
        ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      if (detailRef.current) detailRef.current.scrollTop = 0;
    });
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (model.changes.length === 0) return;
      const from = changeIndex < 0 ? (direction === 1 ? -1 : 0) : changeIndex;
      const next = (from + direction + model.changes.length) % model.changes.length;
      select(model.changes[next].key);
    },
    [changeIndex, model.changes, select],
  );

  const accept = useCallback(
    (ids: string[]) => {
      const next = acceptProposals(ids, decisions, proposals);
      setDecisions(next);
      step(1);
    },
    [decisions, proposals, step],
  );
  const reject = useCallback(
    (ids: string[]) => {
      const next = rejectProposals(ids, decisions, proposals);
      setDecisions(next);
      step(1);
    },
    [decisions, proposals, step],
  );

  const summary = decisionSummary(proposals, decisions);
  const assessedLessonIds = new Set(preview.assessedLessonIds ?? []);
  const acceptedOperationIds = new Set(
    summary.accepted.flatMap((proposal) => proposal.operationIds),
  );
  const requiresAssessmentAcknowledgement = (preview.operations ?? []).some(
    (operation) =>
      acceptedOperationIds.has(operation.operationId) &&
      assessedLessonIds.has(operation.targetId) &&
      operation.type !== AUTHORING_OPERATION_TYPE.LESSON_BLOCK_REPLACE,
  );

  const apply = async (acknowledgeAssessmentChanges: boolean) => {
    if (!actions?.applyReview || applying) return false;
    setApplying(true);
    try {
      await actions.applyReview({
        acceptedProposalIds: summary.accepted.map((proposal) => proposal.id),
        rejectedProposalIds: summary.rejected.map((proposal) => proposal.id),
        acknowledgeAssessmentChanges,
      });
      toast({
        description: t(
          outlineOnly
            ? "courseAuthoring.reviewMode.outlineApprovedToast"
            : "courseAuthoring.reviewMode.applyingToast",
        ),
      });
      if (outlineOnly) onExit();
      else onApplied();
      return true;
    } catch {
      // The session reports the failure; keep the staged review for a retry.
      return false;
    } finally {
      setApplying(false);
    }
  };

  const discard = async () => {
    if (!actions?.applyReview || applying) return;
    setApplying(true);
    try {
      await actions.applyReview({
        acceptedProposalIds: [],
        rejectedProposalIds: [...summary.accepted, ...summary.pending].map(
          (proposal) => proposal.id,
        ),
        acknowledgeAssessmentChanges: false,
      });
      toast({ description: t("courseAuthoring.reviewMode.discardedToast") });
      onApplied();
    } catch {
      // The session reports the failure; keep the review open for a retry.
    } finally {
      setApplying(false);
    }
  };

  const submitRevision = handleSubmit(async () => {
    const requestedChanges = feedbackText.trim();
    const pending = proposals.filter((proposal) => proposal.decision === PROPOSAL_DECISION.PENDING);
    if (
      !requestedChanges ||
      feedbackText.length > COURSE_AUTHORING_FEEDBACK_MAX_LENGTH ||
      !actions?.refineBatch ||
      pending.length === 0 ||
      submittingRefinements
    )
      return;
    setSubmittingRefinements(true);
    try {
      await actions.refineBatch(
        pending.map((proposal) => ({ proposalId: proposal.id, feedback: requestedChanges })),
      );
      clearFeedback();
      setFeedbackDialogOpen(false);
      onExit();
    } catch {
      // Keep the written request available for a retry.
    } finally {
      setSubmittingRefinements(false);
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        feedbackDialogOpen ||
        assessmentConfirmationOpen ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      const key = event.key.toLowerCase();
      if (key === REVIEW_SHORTCUT.NEXT) step(1);
      else if (key === REVIEW_SHORTCUT.PREVIOUS) step(-1);
      else if (key === REVIEW_SHORTCUT.EXIT) onExit();
      else if (!readOnly && selectedNode && selectedNode.proposalIds.length > 0) {
        if (key === REVIEW_SHORTCUT.ACCEPT) accept(selectedNode.proposalIds);
        else if (key === REVIEW_SHORTCUT.REJECT) reject(selectedNode.proposalIds);
        else return;
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    accept,
    assessmentConfirmationOpen,
    feedbackDialogOpen,
    onExit,
    readOnly,
    reject,
    selectedNode,
    step,
  ]);

  return (
    <Dialog
      open={feedbackDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (submittingRefinements) return;
          clearFeedback();
        }
        setFeedbackDialogOpen(open);
      }}
    >
      <div className="flex w-full flex-col gap-6" data-testid="course-authoring-review-workspace">
        <CurriculumReviewBar
          outlineOnly={outlineOnly}
          totalChanges={model.changes.length}
          currentIndex={changeIndex < 0 ? null : changeIndex}
          readOnly={readOnly}
          streaming={streaming}
          applying={applying}
          requiresAssessmentAcknowledgement={requiresAssessmentAcknowledgement}
          assessmentConfirmationOpen={assessmentConfirmationOpen}
          onAssessmentConfirmationOpenChange={setAssessmentConfirmationOpen}
          changesOnly={changesOnly}
          onChangesOnlyChange={setChangesOnly}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
          onApply={apply}
          onDiscard={() => void discard()}
          onExit={onExit}
        />
        {failedAssetIds.length > 0 && (
          <Alert>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{t("courseAuthoring.review.imagePreviewFailed")}</span>
              <Button
                type="button"
                variant="outline"
                disabled={retryingPreviews}
                onClick={() => void retryFailedPreviews()}
              >
                {t("courseAuthoring.review.retryImagePreviews")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="flex w-full flex-col md:w-[480px] md:shrink-0">
            <ReviewCurriculumList
              model={model}
              decisions={decisions}
              selectedKey={selectedKey}
              changesOnly={changesOnly}
              language={language}
              baseLanguage={baseLanguage}
              onSelect={select}
            />
          </div>
          <div
            ref={detailRef}
            className="min-w-0 flex-1 md:sticky md:top-32 md:max-h-[calc(100dvh-10rem)] md:overflow-y-auto"
          >
            {selectedNode ? (
              <ReviewChangeDetail
                key={selectedKey}
                node={selectedNode}
                model={model}
                proposals={proposals}
                courseTitle={preview.courseTitle}
                nativeForm={nativeForm}
                assetPreviewUrls={assetPreviewUrls}
              />
            ) : (
              <p className="body-base rounded-lg bg-white p-8 text-center text-neutral-600">
                {t("courseAuthoring.reviewMode.selectPrompt")}
              </p>
            )}
          </div>
        </div>
      </div>
      {actions?.refineBatch && !readOnly && (
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          noCloseButton={submittingRefinements}
        >
          <DialogHeader>
            <DialogTitle>{t("courseAuthoring.reviewMode.revisionHeading")}</DialogTitle>
            <DialogDescription>{t("courseAuthoring.reviewMode.revisionHint")}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void submitRevision(event)}>
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
                  id="curriculum-review-feedback"
                  content={field.value ?? ""}
                  onChange={field.onChange}
                  onTextChange={setFeedbackText}
                  onBlur={() => field.onBlur()}
                  ariaLabel={t("courseAuthoring.reviewMode.revisionHeading")}
                  placeholder={t("courseAuthoring.reviewMode.revisionPlaceholder")}
                  editable={!submittingRefinements}
                  contentClassName="min-h-0 max-h-40 overflow-y-auto sm:max-h-48"
                  editorClassName="min-h-28 p-3"
                />
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={submittingRefinements}
                onClick={() => {
                  clearFeedback();
                  setFeedbackDialogOpen(false);
                }}
              >
                {t("courseAuthoring.review.cancelFeedback")}
              </Button>
              <Button
                type="submit"
                disabled={
                  !feedbackText.trim() ||
                  feedbackText.length > COURSE_AUTHORING_FEEDBACK_MAX_LENGTH ||
                  submittingRefinements
                }
              >
                {submittingRefinements && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                {t("courseAuthoring.reviewMode.submitRevision")}
              </Button>
            </DialogFooter>
            <p className="text-right text-xs text-neutral-500" aria-live="polite">
              {t("courseAuthoring.review.feedbackCount", {
                count: feedbackText.length,
              })}
            </p>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
};
