import { CircleAlert, CircleCheck, FilePenLine, ListTree, LoaderCircle, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import {
  AUTHORING_OPERATION_TYPE,
  PROPOSAL_APPLICATION_STATUS,
  PROPOSAL_DECISION,
  REVIEW_CHANGE_KIND,
} from "../review/curriculumReview.constants";
import { ReviewKindBadge } from "../review/ReviewChangeBadge";

import type { ProposalApplicationStatus } from "./ProposalReview";
import type { AuthoringOperation, OutlineChapter, ProposalView } from "../courseAuthoring.types";
import type { ChangedKind } from "../review/curriculumReview.types";

export const CHANGE_SET_STATE = {
  READY: "ready",
  OUTLINE_READY: "outlineReady",
  OUTLINE_APPROVED: "outlineApproved",
  APPROVED_NOT_APPLIED: "approvedNotApplied",
  APPLYING: "applying",
  APPLIED: "applied",
  FAILED: "failed",
  CONFLICT: "conflict",
  DISCARDED: "discarded",
  REVISING: "revising",
  GENERATING: "generating",
} as const;

type ChangeSetState = (typeof CHANGE_SET_STATE)[keyof typeof CHANGE_SET_STATE];

type Props = {
  requestId: string;
  proposals: ProposalView[];
  busy?: boolean;
  incomplete?: boolean;
  onReview?: (focusProposalId?: string) => void;
  onDiscard?: () => void;
  targetLabelById?: Record<string, string>;
  applicationStatusByProposalId?: Record<string, ProposalApplicationStatus>;
  onRetryApply?: () => void;
  retryDisabled?: boolean;
};

const VISIBLE_ROWS = 4;
const VISIBLE_OUTLINE_LESSONS = 4;
const emptyStatuses: Record<string, ProposalApplicationStatus> = {};

const operationKind = (type: string): ChangedKind =>
  match(type)
    .with(
      AUTHORING_OPERATION_TYPE.LESSON_CREATE,
      AUTHORING_OPERATION_TYPE.COURSE_LESSON_CREATE,
      AUTHORING_OPERATION_TYPE.CHAPTER_CREATE,
      () => REVIEW_CHANGE_KIND.ADDED,
    )
    .with(
      AUTHORING_OPERATION_TYPE.LESSON_DELETE,
      AUTHORING_OPERATION_TYPE.CHAPTER_DELETE,
      () => REVIEW_CHANGE_KIND.REMOVED,
    )
    .with(
      AUTHORING_OPERATION_TYPE.LESSON_REORDER,
      AUTHORING_OPERATION_TYPE.CHAPTER_REORDER,
      () => REVIEW_CHANGE_KIND.MOVED,
    )
    .otherwise(() => REVIEW_CHANGE_KIND.EDITED);

const COURSE_LEVEL_TYPES = new Set<string>([
  AUTHORING_OPERATION_TYPE.COURSE_METADATA_UPDATE,
  AUTHORING_OPERATION_TYPE.COURSE_SETTINGS_UPDATE,
]);

type ChangeRow = {
  key: string;
  proposalId: string;
  kind: ChangedKind;
  label: string;
  detail: string | null;
};

const STATE_ICON: Record<ChangeSetState, typeof CircleCheck> = {
  [CHANGE_SET_STATE.READY]: FilePenLine,
  [CHANGE_SET_STATE.OUTLINE_READY]: ListTree,
  [CHANGE_SET_STATE.OUTLINE_APPROVED]: ListTree,
  [CHANGE_SET_STATE.APPROVED_NOT_APPLIED]: FilePenLine,
  [CHANGE_SET_STATE.APPLYING]: LoaderCircle,
  [CHANGE_SET_STATE.APPLIED]: CircleCheck,
  [CHANGE_SET_STATE.FAILED]: CircleAlert,
  [CHANGE_SET_STATE.CONFLICT]: CircleAlert,
  [CHANGE_SET_STATE.DISCARDED]: Undo2,
  [CHANGE_SET_STATE.REVISING]: Undo2,
  [CHANGE_SET_STATE.GENERATING]: LoaderCircle,
};

const STATE_TONE: Record<ChangeSetState, string> = {
  [CHANGE_SET_STATE.READY]: "text-primary-700",
  [CHANGE_SET_STATE.OUTLINE_READY]: "text-primary-700",
  [CHANGE_SET_STATE.OUTLINE_APPROVED]: "text-success-700",
  [CHANGE_SET_STATE.APPROVED_NOT_APPLIED]: "text-warning-800",
  [CHANGE_SET_STATE.APPLYING]: "text-primary-700",
  [CHANGE_SET_STATE.APPLIED]: "text-success-700",
  [CHANGE_SET_STATE.FAILED]: "text-error-700",
  [CHANGE_SET_STATE.CONFLICT]: "text-error-700",
  [CHANGE_SET_STATE.DISCARDED]: "text-neutral-500",
  [CHANGE_SET_STATE.REVISING]: "text-primary-700",
  [CHANGE_SET_STATE.GENERATING]: "text-primary-700",
};

export const ProposalGroup = ({
  requestId,
  proposals,
  busy,
  incomplete = false,
  onReview,
  onDiscard,
  targetLabelById = {},
  applicationStatusByProposalId = emptyStatuses,
  onRetryApply,
  retryDisabled,
}: Props) => {
  const { t } = useTranslation();
  const statusOf = (proposal: ProposalView): ProposalApplicationStatus | null =>
    applicationStatusByProposalId[proposal.id] ??
    (proposal.decision === PROPOSAL_DECISION.APPLIED ? PROPOSAL_APPLICATION_STATUS.APPLIED : null);
  const statuses = proposals.map(statusOf);
  const isOutline = (proposal: ProposalView) =>
    proposal.outline !== null && proposal.operations.length === 0;
  const pending = proposals.filter(
    (proposal) =>
      proposal.decision === PROPOSAL_DECISION.PENDING &&
      statusOf(proposal) !== PROPOSAL_APPLICATION_STATUS.APPLIED,
  );
  const approvedNotApplied = proposals.filter(
    (proposal) =>
      proposal.decision === PROPOSAL_DECISION.ACCEPTED &&
      proposal.operations.length > 0 &&
      statusOf(proposal) === null,
  );

  const state: ChangeSetState = (() => {
    if (incomplete && pending.length > 0) return CHANGE_SET_STATE.GENERATING;
    if (
      statuses.some(
        (status) =>
          status === PROPOSAL_APPLICATION_STATUS.APPLYING ||
          status === PROPOSAL_APPLICATION_STATUS.SYNCHRONIZING,
      )
    )
      return CHANGE_SET_STATE.APPLYING;
    if (statuses.includes(PROPOSAL_APPLICATION_STATUS.CONFLICT)) return CHANGE_SET_STATE.CONFLICT;
    if (statuses.includes(PROPOSAL_APPLICATION_STATUS.FAILED)) return CHANGE_SET_STATE.FAILED;
    if (pending.length > 0)
      return pending.every(isOutline) ? CHANGE_SET_STATE.OUTLINE_READY : CHANGE_SET_STATE.READY;
    if (approvedNotApplied.length > 0) return CHANGE_SET_STATE.APPROVED_NOT_APPLIED;
    if (statuses.includes(PROPOSAL_APPLICATION_STATUS.APPLIED)) return CHANGE_SET_STATE.APPLIED;
    if (proposals.some((proposal) => proposal.decision === PROPOSAL_DECISION.ACCEPTED))
      return CHANGE_SET_STATE.OUTLINE_APPROVED;
    if (proposals.some((proposal) => proposal.decision === PROPOSAL_DECISION.SUPERSEDED))
      return CHANGE_SET_STATE.REVISING;
    return CHANGE_SET_STATE.DISCARDED;
  })();

  const rowSource = match(state)
    .with(
      CHANGE_SET_STATE.READY,
      CHANGE_SET_STATE.OUTLINE_READY,
      CHANGE_SET_STATE.GENERATING,
      () => pending,
    )
    .with(CHANGE_SET_STATE.APPROVED_NOT_APPLIED, () => approvedNotApplied)
    .with(CHANGE_SET_STATE.DISCARDED, () => proposals)
    .otherwise(() =>
      proposals.filter((proposal) => proposal.decision !== PROPOSAL_DECISION.REJECTED),
    );

  const courseTitleChange = (operation: AuthoringOperation) =>
    operation.type === AUTHORING_OPERATION_TYPE.COURSE_METADATA_UPDATE &&
    typeof operation.payload.title === "string"
      ? operation.payload.title
      : null;

  const rowFor = (proposal: ProposalView, operation: AuthoringOperation): ChangeRow => {
    const kind = operationKind(operation.type);
    const newTitle = courseTitleChange(operation);
    if (newTitle) {
      const currentTitle = targetLabelById[operation.targetId];
      return {
        key: `${kind}:course-title`,
        proposalId: proposal.id,
        kind,
        label: t("courseAuthoring.reviewMode.courseTitle"),
        detail:
          currentTitle && currentTitle !== newTitle ? `${currentTitle} → ${newTitle}` : newTitle,
      };
    }
    if (COURSE_LEVEL_TYPES.has(operation.type)) {
      return {
        key: `${kind}:course`,
        proposalId: proposal.id,
        kind,
        label: t("courseAuthoring.reviewMode.courseDetails"),
        detail: null,
      };
    }
    const title = typeof operation.payload.title === "string" ? operation.payload.title : null;
    const label =
      targetLabelById[operation.targetId] ?? title ?? t("courseAuthoring.review.unknownChange");
    return { key: `${kind}:${label}`, proposalId: proposal.id, kind, label, detail: null };
  };

  const rows: ChangeRow[] = [];
  const outlineChapters: Array<{ proposalId: string; chapter: OutlineChapter }> = [];
  const seen = new Set<string>();
  const addRow = (row: ChangeRow) => {
    if (seen.has(row.key)) return;
    seen.add(row.key);
    rows.push(row);
  };
  rowSource.forEach((proposal) => {
    if (proposal.operations.length === 0) {
      proposal.outline?.forEach((chapter) =>
        outlineChapters.push({ proposalId: proposal.id, chapter }),
      );
      return;
    }
    proposal.operations.forEach((operation) => addRow(rowFor(proposal, operation)));
  });
  const hiddenCount = Math.max(rows.length - VISIBLE_ROWS, 0);
  const hiddenChapterCount = Math.max(outlineChapters.length - VISIBLE_ROWS, 0);
  const showDetails = state !== CHANGE_SET_STATE.REVISING;

  const canReview =
    Boolean(onReview) &&
    [
      CHANGE_SET_STATE.READY,
      CHANGE_SET_STATE.OUTLINE_READY,
      CHANGE_SET_STATE.APPROVED_NOT_APPLIED,
    ].some((value) => value === state);
  const canRetry =
    Boolean(onRetryApply) &&
    (state === CHANGE_SET_STATE.FAILED || state === CHANGE_SET_STATE.CONFLICT);
  const isOutlineState = proposals.length > 0 && proposals.every(isOutline);
  const heading = t(
    isOutlineState
      ? "courseAuthoring.changeSet.outlineHeading"
      : "courseAuthoring.changeSet.heading",
  );
  const Icon = STATE_ICON[state];
  const needsAction = canReview || canRetry;

  return (
    <section
      className={cn(
        "max-w-xl space-y-2 rounded-lg border p-3 shadow-sm",
        needsAction ? "border-primary-200 bg-primary-50" : "border-neutral-200 bg-white",
      )}
      data-testid={`course-authoring-proposal-group-${requestId}`}
      data-state={state}
      aria-label={heading}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-sm font-semibold text-neutral-950">{heading}</span>
        <span
          role="status"
          aria-live="polite"
          className={cn("inline-flex items-center gap-1.5 text-xs font-medium", STATE_TONE[state])}
        >
          <Icon
            className={cn(
              "size-3.5",
              (state === CHANGE_SET_STATE.APPLYING || state === CHANGE_SET_STATE.GENERATING) &&
                "animate-spin",
            )}
            aria-hidden="true"
          />
          {t(`courseAuthoring.changeSet.${state}.status`)}
        </span>
      </div>

      {outlineChapters.length > 0 && showDetails && (
        <ol className="space-y-1" data-testid={`course-authoring-outline-${requestId}`}>
          {outlineChapters.slice(0, VISIBLE_ROWS).map(({ proposalId, chapter }, index) => {
            const hiddenLessonCount = Math.max(chapter.lessons.length - VISIBLE_OUTLINE_LESSONS, 0);
            const outlineContent = (
              <>
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-600">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 break-words font-medium text-neutral-900">
                      {chapter.title}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500">
                      {t("courseAuthoring.changeSet.lessonCount", {
                        count: chapter.lessons.length,
                      })}
                    </span>
                  </span>
                  {chapter.lessons.length > 0 && (
                    <ul className="mt-1 space-y-0.5 border-l border-neutral-200 pl-3">
                      {chapter.lessons.slice(0, VISIBLE_OUTLINE_LESSONS).map((lesson) => (
                        <li
                          key={lesson.id}
                          className="truncate text-xs leading-5 text-neutral-600"
                          title={lesson.title}
                        >
                          {lesson.title}
                        </li>
                      ))}
                      {hiddenLessonCount > 0 && (
                        <li className="text-xs leading-5 text-neutral-500">
                          {t("courseAuthoring.changeSet.more", { count: hiddenLessonCount })}
                        </li>
                      )}
                    </ul>
                  )}
                </span>
              </>
            );
            return (
              <li key={chapter.id}>
                {canReview ? (
                  <button
                    type="button"
                    className="flex w-full items-start gap-2.5 rounded-md px-1 py-1 text-left text-sm enabled:hover:bg-white disabled:cursor-default"
                    disabled={busy}
                    onClick={() => onReview?.(proposalId)}
                  >
                    {outlineContent}
                  </button>
                ) : (
                  <div className="flex w-full items-start gap-2.5 rounded-md px-1 py-1 text-left text-sm">
                    {outlineContent}
                  </div>
                )}
              </li>
            );
          })}
          {hiddenChapterCount > 0 && (
            <li className="px-1 py-1 text-xs text-neutral-500">
              {t("courseAuthoring.changeSet.more", { count: hiddenChapterCount })}
            </li>
          )}
        </ol>
      )}

      {rows.length > 0 && showDetails && (
        <ol className="space-y-0.5">
          {rows.slice(0, VISIBLE_ROWS).map((row) => {
            const rowContent = (
              <>
                <ReviewKindBadge kind={row.kind} className="w-16" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-neutral-800">{row.label}</span>
                  {row.detail && <span className="ml-2 text-neutral-500">{row.detail}</span>}
                </span>
              </>
            );
            return (
              <li key={row.key}>
                {canReview ? (
                  <button
                    type="button"
                    className="flex min-h-8 w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm enabled:hover:bg-white disabled:cursor-default"
                    disabled={busy}
                    onClick={() => onReview?.(row.proposalId)}
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div className="flex min-h-8 w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm">
                    {rowContent}
                  </div>
                )}
              </li>
            );
          })}
          {hiddenCount > 0 && (
            <li className="px-1 py-1 text-xs text-neutral-500">
              {t("courseAuthoring.changeSet.more", { count: hiddenCount })}
            </li>
          )}
        </ol>
      )}

      <p className="px-1 text-xs text-neutral-600">
        {t(`courseAuthoring.changeSet.${state}.description`)}
      </p>

      {(canReview || canRetry) && (
        <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
          {canReview && (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => onReview?.()}
              data-testid={`course-authoring-review-changes-${requestId}`}
            >
              {t(`courseAuthoring.changeSet.${state}.action`)}
            </Button>
          )}
          {canRetry && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={retryDisabled}
              onClick={onRetryApply}
            >
              {t("courseAuthoring.changeSet.retry")}
            </Button>
          )}
          {canReview && onDiscard && state !== CHANGE_SET_STATE.APPROVED_NOT_APPLIED && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDiscard}>
              {t("courseAuthoring.changeSet.discard")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
