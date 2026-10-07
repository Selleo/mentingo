import { AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { ContentViewer } from "~/components/RichText/Viever";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import { LessonTypeIcon } from "~/modules/Courses/CourseView/LessonTypeIcon";
import { getLessonTypeTranslationKey } from "~/modules/Courses/CourseView/lessonTypes";

import { AuthoringOperationPreview } from "../components/AuthoringOperationPreview";

import { applyBlockReplacements } from "./contentDiff";
import { ContentDiffView } from "./ContentDiffView";
import {
  AUTHORING_OPERATION_TYPE,
  REVIEW_CHANGE_KIND,
  REVIEW_NODE_TYPE,
} from "./curriculumReview.constants";
import { currentQuestion, proposedQuestion } from "./quizDiff";
import { QuizDiffView } from "./QuizDiffView";
import { ReviewKindBadge } from "./ReviewChangeBadge";

import type {
  CurriculumReviewModel,
  ReviewChapterNode,
  ReviewCourseNode,
  ReviewLessonNode,
  ReviewNode,
  ReviewProposal,
} from "./curriculumReview.types";
import type { ReviewQuestion } from "./quizDiff";
import type { AuthoringOperation } from "../courseAuthoring.types";
import type {
  Lesson,
  LessonType as LessonTypeValue,
} from "~/modules/Admin/EditCourse/EditCourse.types";

type Props = {
  node: ReviewNode;
  model: CurriculumReviewModel;
  proposals: ReviewProposal[];
  courseTitle?: string;
  nativeForm?: ReactNode;
  assetPreviewUrls?: Readonly<Record<string, string>>;
};

const DETAIL_VIEW = { FORM: "form", CHANGES: "changes" } as const;
type DetailView = (typeof DETAIL_VIEW)[keyof typeof DETAIL_VIEW];

const LIVE_LESSON_OPERATION_TYPE = "lesson.live";

const stringOf = (value: unknown) => (typeof value === "string" ? value : null);

const LiveLessonPreview = ({ lesson }: { lesson: Lesson }) => (
  <AuthoringOperationPreview
    compact={false}
    lessonType={lesson.type}
    operation={{
      operationId: `live-${lesson.id}`,
      targetId: lesson.id,
      type: LIVE_LESSON_OPERATION_TYPE,
      dependencies: [],
      payload: {
        lessonType: lesson.type,
        description: lesson.description,
        questions: lesson.questions ?? [],
        thresholdScore: lesson.thresholdScore,
        attemptsLimit: lesson.attemptsLimit,
        quizCooldownInHours: lesson.quizCooldownInHours,
      },
    }}
  />
);

const EditedLessonBody = ({
  node,
  assetPreviewUrls,
}: {
  node: ReviewLessonNode;
  assetPreviewUrls?: Readonly<Record<string, string>>;
}) => {
  const { t } = useTranslation();
  const update = node.operations.find(
    (operation) =>
      operation.type === AUTHORING_OPERATION_TYPE.LESSON_UPDATE ||
      operation.type === AUTHORING_OPERATION_TYPE.COURSE_LESSON_UPDATE,
  );
  const blockReplacements = node.operations.flatMap((operation) => {
    const blockId = stringOf(operation.payload.blockId);
    const html = stringOf(operation.payload.html);
    return operation.type === AUTHORING_OPERATION_TYPE.LESSON_BLOCK_REPLACE && blockId && html
      ? [{ blockId, html }]
      : [];
  });
  const current = node.current;
  const lessonType = stringOf(update?.payload.lessonType) ?? node.lessonType;

  if (lessonType === LessonType.CONTENT && (update || blockReplacements.length > 0)) {
    const before = current?.description ?? "";
    const base = stringOf(update?.payload.description) ?? before;
    return (
      <ContentDiffView
        before={before}
        after={applyBlockReplacements(base, blockReplacements)}
        assetPreviewUrls={assetPreviewUrls}
      />
    );
  }

  if (lessonType === LessonType.QUIZ && update && Array.isArray(update.payload.questions)) {
    const after = update.payload.questions
      .map((question, index) => proposedQuestion(question, index))
      .filter((question): question is ReviewQuestion => question !== null);
    const numberText = (value: unknown, format: (count: number) => string) =>
      typeof value === "number" ? format(value) : null;
    const attempts = (value: unknown) =>
      typeof value === "number"
        ? t("courseAuthoring.review.attempts", { count: value })
        : t("courseAuthoring.review.unlimitedAttempts");
    return (
      <QuizDiffView
        before={(current?.questions ?? []).map(currentQuestion)}
        after={after}
        settings={[
          {
            label: t("courseAuthoring.reviewMode.passScore"),
            before: numberText(current?.thresholdScore, (score) => `${score}%`),
            after: numberText(update.payload.thresholdScore, (score) => `${score}%`) ?? "—",
          },
          {
            label: t("courseAuthoring.reviewMode.attempts"),
            before: current ? attempts(current.attemptsLimit ?? null) : null,
            after: attempts(update.payload.attemptsLimit ?? null),
          },
        ]}
      />
    );
  }

  if (update) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-neutral-600">
          {t("courseAuthoring.reviewMode.proposedVersion")}
        </p>
        <AuthoringOperationPreview
          operation={update}
          assetPreviewUrls={assetPreviewUrls}
          lessonType={node.lessonType}
          compact={false}
        />
      </div>
    );
  }

  return <p className="text-sm text-neutral-600">{t("courseAuthoring.reviewMode.titleOnly")}</p>;
};

const LessonBody = ({
  node,
  chapterNumber,
  assetPreviewUrls,
}: {
  node: ReviewLessonNode;
  chapterNumber: (id: string) => number;
  assetPreviewUrls?: Readonly<Record<string, string>>;
}) => {
  const { t } = useTranslation();
  const create = node.operations.find(
    (operation) =>
      operation.type === AUTHORING_OPERATION_TYPE.LESSON_CREATE ||
      operation.type === AUTHORING_OPERATION_TYPE.COURSE_LESSON_CREATE,
  );
  const moveNote = node.movedFrom && (
    <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">
      {t("courseAuthoring.reviewMode.movedFromPosition", {
        chapter: chapterNumber(node.movedFrom.chapterId),
        position: node.movedFrom.position + 1,
      })}
    </p>
  );
  return (
    <div className="space-y-4">
      {moveNote}
      {match(node.kind)
        .with(REVIEW_CHANGE_KIND.REMOVED, () => (
          <>
            <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">
              {t("courseAuthoring.reviewMode.lessonRemovedNotice")}
            </p>
            {node.current && <LiveLessonPreview lesson={node.current} />}
          </>
        ))
        .with(REVIEW_CHANGE_KIND.ADDED, () =>
          create ? (
            <AuthoringOperationPreview
              operation={create}
              assetPreviewUrls={assetPreviewUrls}
              lessonType={node.lessonType}
              compact={false}
            />
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-300 px-4 py-5">
              <LessonTypeIcon
                type={node.lessonType as LessonTypeValue}
                className="size-6 shrink-0 text-primary-700"
              />
              <div className="flex flex-col">
                <span className="body-sm-md text-neutral-900">
                  {t(getLessonTypeTranslationKey(node.lessonType as LessonTypeValue), {
                    defaultValue: node.lessonType,
                  })}
                </span>
                <span className="body-sm text-neutral-600">
                  {t("courseAuthoring.reviewMode.outlineLessonPending")}
                </span>
              </div>
            </div>
          ),
        )
        .with(REVIEW_CHANGE_KIND.EDITED, () => (
          <EditedLessonBody node={node} assetPreviewUrls={assetPreviewUrls} />
        ))
        .otherwise(
          () =>
            node.current && (
              <>
                {node.kind === REVIEW_CHANGE_KIND.UNCHANGED && (
                  <p className="text-xs text-neutral-500">
                    {t("courseAuthoring.reviewMode.noChanges")}
                  </p>
                )}
                <LiveLessonPreview lesson={node.current} />
              </>
            ),
        )}
    </div>
  );
};

const ChapterBody = ({ node }: { node: ReviewChapterNode }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {node.kind === REVIEW_CHANGE_KIND.REMOVED && (
        <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">
          {t("courseAuthoring.reviewMode.chapterRemovedNotice", { count: node.lessons.length })}
        </p>
      )}
      {node.movedFrom && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">
          {t("courseAuthoring.reviewMode.chapterMovedFrom", {
            position: node.movedFrom.position + 1,
          })}
        </p>
      )}
      <ol className="space-y-1.5">
        {node.lessons.map((lesson) => (
          <li key={lesson.id} className="flex items-center justify-between gap-2 text-sm">
            <span
              className={cn("min-w-0 truncate text-neutral-800", {
                "text-neutral-500 line-through": lesson.kind === REVIEW_CHANGE_KIND.REMOVED,
              })}
            >
              {lesson.title}
            </span>
            {lesson.kind !== REVIEW_CHANGE_KIND.UNCHANGED && <ReviewKindBadge kind={lesson.kind} />}
          </li>
        ))}
      </ol>
    </div>
  );
};

const CourseBody = ({ node, courseTitle }: { node: ReviewCourseNode; courseTitle?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-y-6">
      {node.operations.map((operation: AuthoringOperation) => {
        const title = stringOf(operation.payload.title);
        const description = stringOf(operation.payload.description);
        if (operation.type === AUTHORING_OPERATION_TYPE.COURSE_METADATA_UPDATE) {
          return (
            <div key={operation.operationId} className="flex flex-col gap-y-6">
              {title && (
                <div className="flex flex-col gap-y-1.5">
                  <Label className="body-base-md text-neutral-950">
                    {t("courseAuthoring.reviewMode.courseTitle")}
                  </Label>
                  <Input
                    readOnly
                    value={title}
                    className="cursor-default bg-neutral-50 text-neutral-800"
                  />
                  {courseTitle && courseTitle !== title && (
                    <p className="details text-neutral-500">
                      {t("courseAuthoring.reviewMode.previously", { value: courseTitle })}
                    </p>
                  )}
                </div>
              )}
              {description && (
                <div className="flex flex-col gap-y-1.5">
                  <Label className="body-base-md text-neutral-950">
                    {t("courseAuthoring.reviewMode.courseDescription")}
                  </Label>
                  <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2">
                    <ContentViewer content={description} className="text-sm" />
                  </div>
                </div>
              )}
            </div>
          );
        }
        const impacts = [
          "lessonSequenceEnabled" in operation.payload &&
            "courseAuthoring.review.impacts.lessonSequence",
          "videoCompletionTrackingEnabled" in operation.payload &&
            "courseAuthoring.review.impacts.videoCompletion",
          "certificateValidity" in operation.payload &&
            "courseAuthoring.review.impacts.certificateValidity",
          operation.payload.applyValidityToExistingCertificates === true &&
            "courseAuthoring.review.impacts.existingCertificates",
        ].filter((key): key is string => typeof key === "string");
        return (
          <ul
            key={operation.operationId}
            className="space-y-1 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-950"
          >
            {impacts.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
};

export const ReviewChangeDetail = ({
  node,
  model,
  proposals,
  courseTitle,
  nativeForm,
  assetPreviewUrls,
}: Props) => {
  const { t } = useTranslation();
  const [view, setView] = useState<DetailView>(nativeForm ? DETAIL_VIEW.FORM : DETAIL_VIEW.CHANGES);
  const nodeProposals = proposals.filter((proposal) => node.proposalIds.includes(proposal.id));
  const kind = node.kind === REVIEW_CHANGE_KIND.UNCHANGED ? null : node.kind;
  const previousTitle = node.nodeType === REVIEW_NODE_TYPE.COURSE ? null : node.previousTitle;
  const showViewSwitch = Boolean(nativeForm) && node.kind === REVIEW_CHANGE_KIND.EDITED;
  const reason = [...new Set(nodeProposals.map((proposal) => proposal.rationale.trim()))]
    .filter(Boolean)
    .join(" ");
  const warnings = nodeProposals.flatMap((proposal) => proposal.warnings);
  const showSummary =
    Boolean(reason) || warnings.length > 0 || Boolean(previousTitle) || showViewSwitch;
  const chapterPosition = (chapterId: string) =>
    model.chapters.findIndex((chapter) => chapter.id === chapterId) + 1;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg bg-white"
      data-testid="course-authoring-review-detail"
    >
      {showSummary && (
        <div
          className="flex flex-col gap-y-3 border-b border-neutral-100 px-8 pb-4 pt-6"
          aria-label={node.title || t("courseAuthoring.reviewMode.courseDetails")}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {kind && <ReviewKindBadge kind={kind} />}
            <div className="min-w-0 flex-1">
              {previousTitle && (
                <p className="body-sm flex flex-wrap items-center gap-1.5 text-neutral-600">
                  <span className="line-through">{previousTitle}</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                  <span className="text-neutral-900">{node.title}</span>
                </p>
              )}
              {reason && <p className="body-sm text-neutral-700">{reason}</p>}
            </div>
            {showViewSwitch && (
              <div
                role="tablist"
                aria-label={t("courseAuthoring.reviewMode.viewMode")}
                className="inline-flex rounded-lg border border-neutral-200 p-0.5"
              >
                {Object.values(DETAIL_VIEW).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={view === value}
                    className={cn(
                      "body-sm-md rounded-md px-3 py-1.5 text-neutral-700 transition-colors hover:text-neutral-950",
                      view === value && "bg-primary-50 text-primary-800 hover:text-primary-800",
                    )}
                    onClick={() => setView(value)}
                  >
                    {t(`courseAuthoring.reviewMode.detailView.${value}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <details className="group">
              <summary className="details inline-flex cursor-pointer list-none items-center gap-1.5 text-warning-800 [&::-webkit-details-marker]:hidden">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                {t("courseAuthoring.reviewMode.qualityNotes", { count: warnings.length })}
                <ChevronDown
                  className="size-3.5 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <ul className="mt-2 flex max-h-40 list-disc flex-col gap-y-1.5 overflow-y-auto pl-6 pr-2">
                {warnings.map((warning) => (
                  <li key={warning} className="body-sm text-neutral-700">
                    {warning}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {view === DETAIL_VIEW.FORM && nativeForm ? (
        nativeForm
      ) : (
        <section className="flex flex-col gap-y-6 p-8">
          <h2 className="h5 break-words text-neutral-950">
            {node.nodeType === REVIEW_NODE_TYPE.COURSE
              ? t("courseAuthoring.reviewMode.courseDetails")
              : node.title}
          </h2>
          {match(node)
            .with({ nodeType: REVIEW_NODE_TYPE.LESSON }, (lesson) => (
              <LessonBody
                node={lesson}
                chapterNumber={(id) => chapterPosition(id)}
                assetPreviewUrls={assetPreviewUrls}
              />
            ))
            .with({ nodeType: REVIEW_NODE_TYPE.CHAPTER }, (chapter) => (
              <ChapterBody node={chapter} />
            ))
            .with({ nodeType: REVIEW_NODE_TYPE.COURSE }, (course) => (
              <CourseBody node={course} courseTitle={courseTitle} />
            ))
            .exhaustive()}
        </section>
      )}
    </div>
  );
};
