import { useNavigate, useParams } from "@remix-run/react";
import { PERMISSIONS, sanitizeQuizQuestionTitle } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useQuizGradingAnswerDetails } from "~/api/queries/quiz-grading/useQuizGradingAnswerDetails";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";
import Loader from "~/modules/common/Loader/Loader";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { QUIZ_GRADING_HANDLES } from "../../../e2e/data/quiz-grading/handles";

import { GradeAnswerForm } from "./GradeAnswerForm";
import { reviewVerdict } from "./quizGrading.utils";
import { QuizGradingStatusBadge } from "./QuizGradingStatusBadge";

import type { ReactNode } from "react";

const QUEUE_PATH = "/quiz-grading";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="h6 text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="details-md text-neutral-600">{label}</dt>
      <dd className="body-sm text-neutral-950">{value}</dd>
    </div>
  );
}

export default function QuizGradingAnswerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { answerId = "" } = useParams();
  const { permissions } = usePermissions();
  const canGrade = hasPermission(permissions, PERMISSIONS.QUIZ_GRADING_GRADE);
  const { data: answer, isPending, error } = useQuizGradingAnswerDetails(answerId);

  const breadcrumbs = [
    { title: t("quizGrading.title"), href: QUEUE_PATH },
    { title: t("quizGrading.answerTitle"), href: `${QUEUE_PATH}/${answerId}` },
  ];

  const goToNext = (nextAnswerId: string | null) =>
    navigate(nextAnswerId ? `${QUEUE_PATH}/${nextAnswerId}` : QUEUE_PATH);

  if (isPending) return <Loader />;

  if (!answer) {
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <p className="body-base text-neutral-900">
          {getTranslatedApiErrorMessage(error, t, t("quizGrading.errors.answerNotFound"))}
        </p>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4" data-testid={QUIZ_GRADING_HANDLES.ANSWER_PAGE}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="h4">{t("quizGrading.answerTitle")}</h4>
            <QuizGradingStatusBadge status={answer.gradingStatus} />
          </div>
          <Button
            variant="outline"
            disabled={!answer.nextAnswerId}
            onClick={() => goToNext(answer.nextAnswerId)}
            data-testid={QUIZ_GRADING_HANDLES.NEXT_ANSWER_BUTTON}
          >
            {t("quizGrading.nextAnswer")}
          </Button>
        </div>
        <dl className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-white p-6 sm:grid-cols-3">
          <InfoItem label={t("quizGrading.columns.course")} value={answer.course.name} />
          <InfoItem label={t("quizGrading.columns.lesson")} value={answer.lesson.name} />
          <InfoItem label={t("quizGrading.columns.student")} value={answer.student.name} />
          <InfoItem label={t("quizGrading.attempt")} value={answer.attemptNumber} />
          <InfoItem
            label={t("quizGrading.columns.submittedAt")}
            value={formatLocalizedDate(i18n.language, answer.submittedAt)}
          />
          <InfoItem
            label={t("quizGrading.columns.points")}
            value={`${answer.awardedPoints ?? "—"} / ${answer.maximumPoints}`}
          />
        </dl>
        <section className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="flex flex-col gap-2">
            <h2 className="details-md text-neutral-600">{t("quizGrading.question")}</h2>
            <div
              className="body-base-md text-neutral-950"
              data-testid={QUIZ_GRADING_HANDLES.QUESTION_TITLE}
              dangerouslySetInnerHTML={{ __html: sanitizeQuizQuestionTitle(answer.questionTitle) }}
            />
            {answer.questionDescription && (
              <Viewer content={answer.questionDescription} style="prose" />
            )}
          </div>
          {answer.reviewerInstructions && (
            <div className="flex flex-col gap-2 rounded-md bg-warning-50 p-4">
              <h3 className="details-md text-neutral-600">
                {t("quizGrading.reviewerInstructions")}
              </h3>
              <Viewer content={answer.reviewerInstructions} style="prose" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <h3 className="details-md text-neutral-600">{t("quizGrading.studentAnswer")}</h3>
            {/* Learners type open answers into a plain textarea, so render them as text. */}
            <p
              className="body-base whitespace-pre-wrap break-words rounded-md border-l-4 border-primary-500 bg-primary-50 p-4 text-neutral-950"
              data-testid={QUIZ_GRADING_HANDLES.STUDENT_ANSWER}
            >
              {answer.studentAnswer}
            </p>
          </div>
        </section>
        {canGrade && (
          <Section title={t("quizGrading.form.title")}>
            <GradeAnswerForm
              key={`${answer.id}-${answer.reviews.length}`}
              answer={answer}
              onGraded={goToNext}
            />
          </Section>
        )}
        <Section title={t("quizGrading.history.title")}>
          {!answer.reviews.length && (
            <p className="body-sm text-neutral-600">{t("quizGrading.history.empty")}</p>
          )}
          <ol className="flex flex-col gap-3">
            {answer.reviews.map((review) => (
              <li
                key={review.id}
                className="flex flex-col gap-1 rounded-md border border-neutral-200 p-4"
                data-testid={QUIZ_GRADING_HANDLES.REVIEW_HISTORY_ITEM}
              >
                <div className="details-md flex flex-wrap gap-x-3 text-neutral-600">
                  <span>
                    {t("quizGrading.history.revision", { number: review.revisionNumber })}
                  </span>
                  <span>{review.reviewerName}</span>
                  <span>{formatLocalizedDate(i18n.language, review.reviewedAt)}</span>
                </div>
                <span className="body-sm-md text-neutral-950">
                  {t(`quizGrading.verdict.${reviewVerdict(review)}`)}
                  {" · "}
                  {t("quizGrading.points", {
                    points: review.awardedPoints,
                    max: answer.maximumPoints,
                  })}
                </span>
                {review.comment && (
                  <p className="body-sm whitespace-pre-wrap break-words text-neutral-900">
                    {review.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </PageWrapper>
  );
}
