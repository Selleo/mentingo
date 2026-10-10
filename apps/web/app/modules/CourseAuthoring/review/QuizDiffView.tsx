import { Check, Circle } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { cn } from "~/lib/utils";

import { diffWords } from "./contentDiff";
import { BLOCK_DIFF_STATUS, WORD_DIFF_TYPE } from "./curriculumReview.constants";
import { diffQuestions } from "./quizDiff";

import type { QuestionDiffEntry, ReviewAnswer, ReviewQuestion } from "./quizDiff";

type Props = {
  before: ReviewQuestion[];
  after: ReviewQuestion[];
  settings?: Array<{ label: string; before: string | null; after: string }>;
};

const DiffText = ({ before, after }: { before: string; after: string }) => (
  <>
    {diffWords(before, after).map((part, index) =>
      part.type === WORD_DIFF_TYPE.SAME ? (
        <span key={index}>{part.text}</span>
      ) : (
        <span
          key={index}
          className={cn("rounded-sm px-0.5", {
            "bg-success-100 text-success-900": part.type === WORD_DIFF_TYPE.ADDED,
            "bg-error-50 text-error-700 line-through": part.type === WORD_DIFF_TYPE.REMOVED,
          })}
        >
          {part.text}
        </span>
      ),
    )}
  </>
);

type AnswerRow = {
  answer: ReviewAnswer;
  status: (typeof WORD_DIFF_TYPE)[keyof typeof WORD_DIFF_TYPE];
  before?: ReviewAnswer;
};

const answerRows = (before: ReviewAnswer[], after: ReviewAnswer[]): AnswerRow[] => {
  const beforeByKey = new Map(before.map((answer) => [answer.key, answer]));
  const beforeByText = new Map(before.map((answer) => [answer.text, answer]));
  const used = new Set<string>();
  const rows: AnswerRow[] = after.map((answer) => {
    const match = beforeByKey.get(answer.key) ?? beforeByText.get(answer.text);
    if (!match) return { answer, status: WORD_DIFF_TYPE.ADDED };
    used.add(match.key);
    return { answer, status: WORD_DIFF_TYPE.SAME, before: match };
  });
  before
    .filter((answer) => !used.has(answer.key))
    .forEach((answer) => rows.push({ answer, status: WORD_DIFF_TYPE.REMOVED }));
  return rows;
};

const Answers = ({ entry }: { entry: QuestionDiffEntry }) => {
  const { t } = useTranslation();
  const rows: AnswerRow[] = match(entry)
    .with({ status: BLOCK_DIFF_STATUS.ADDED }, ({ after }) =>
      after.answers.map((answer) => ({ answer, status: WORD_DIFF_TYPE.SAME })),
    )
    .with({ status: BLOCK_DIFF_STATUS.REMOVED }, ({ before }) =>
      before.answers.map((answer) => ({ answer, status: WORD_DIFF_TYPE.SAME })),
    )
    .otherwise(({ before, after }) => answerRows(before.answers, after.answers));
  if (rows.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {rows.map(({ answer, status, before }) => {
        const correctnessChanged =
          before !== undefined && before.correct !== null && before.correct !== answer.correct;
        return (
          <li
            key={`${status}-${answer.key}`}
            className={cn("flex items-start gap-2 rounded-md px-2 py-1 text-sm text-neutral-800", {
              "bg-success-50": status === WORD_DIFF_TYPE.ADDED,
              "bg-error-50 text-neutral-500 line-through": status === WORD_DIFF_TYPE.REMOVED,
              "bg-warning-50": correctnessChanged,
            })}
          >
            {answer.correct ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              {before && before.text !== answer.text ? (
                <DiffText before={before.text} after={answer.text} />
              ) : (
                answer.text
              )}
            </span>
            {correctnessChanged && (
              <span className="shrink-0 text-xs font-medium text-warning-900">
                {t(
                  answer.correct
                    ? "courseAuthoring.reviewMode.nowCorrect"
                    : "courseAuthoring.reviewMode.noLongerCorrect",
                )}
              </span>
            )}
            {answer.correct && !correctnessChanged && (
              <span className="sr-only">{t("courseAuthoring.reviewMode.correctAnswer")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const QuestionCard = ({ entry, number }: { entry: QuestionDiffEntry; number: number }) => {
  const { t } = useTranslation();
  const question = entry.status === BLOCK_DIFF_STATUS.REMOVED ? entry.before : entry.after;
  const before = entry.status === BLOCK_DIFF_STATUS.MODIFIED ? entry.before : null;
  return (
    <div
      className={cn("rounded-lg border border-neutral-200 bg-white p-3 border-l-4", {
        "border-l-success-500": entry.status === BLOCK_DIFF_STATUS.ADDED,
        "border-l-error-400 bg-error-50/30": entry.status === BLOCK_DIFF_STATUS.REMOVED,
        "border-l-warning-500": entry.status === BLOCK_DIFF_STATUS.MODIFIED,
      })}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-neutral-500">
          {t("courseAuthoring.review.questionNumber", { number })}
        </p>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {t(`courseAuthoring.reviewMode.blockStatus.${entry.status}`)}
        </span>
      </div>
      <p
        className={cn("mt-1 text-sm font-semibold text-neutral-950", {
          "text-neutral-500 line-through": entry.status === BLOCK_DIFF_STATUS.REMOVED,
        })}
      >
        {before && before.title !== question.title ? (
          <DiffText before={before.title} after={question.title} />
        ) : (
          question.title
        )}
      </p>
      {(question.prompt || before?.prompt) && question.prompt !== question.title && (
        <p className="mt-1 text-sm text-neutral-700">
          {before && before.prompt !== question.prompt ? (
            <DiffText before={before.prompt} after={question.prompt} />
          ) : (
            question.prompt
          )}
        </p>
      )}
      <Answers entry={entry} />
    </div>
  );
};

export const QuizDiffView = ({ before, after, settings = [] }: Props) => {
  const { t } = useTranslation();
  const [showUnchanged, setShowUnchanged] = useState(false);
  const entries = useMemo(() => diffQuestions(before, after), [before, after]);
  const unchangedCount = entries.filter(
    (entry) => entry.status === BLOCK_DIFF_STATUS.UNCHANGED,
  ).length;
  const changedSettings = settings.filter((setting) => setting.before !== setting.after);

  return (
    <div className="space-y-3" data-testid="course-authoring-review-quiz-diff">
      {changedSettings.length > 0 && (
        <dl className="grid gap-2 rounded-lg bg-neutral-50 p-3 text-sm sm:grid-cols-2">
          {changedSettings.map((setting) => (
            <div key={setting.label}>
              <dt className="text-xs text-neutral-500">{setting.label}</dt>
              <dd className="font-medium text-neutral-900">
                {setting.before !== null && (
                  <>
                    <span className="text-neutral-500 line-through">{setting.before}</span>
                    {" → "}
                  </>
                )}
                {setting.after}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {entries.map((entry, index) =>
        entry.status === BLOCK_DIFF_STATUS.UNCHANGED && !showUnchanged ? null : (
          <QuestionCard key={index} entry={entry} number={index + 1} />
        ),
      )}
      {unchangedCount > 0 && (
        <button
          type="button"
          className="text-xs font-medium text-primary-700 hover:underline"
          onClick={() => setShowUnchanged((value) => !value)}
        >
          {t(
            showUnchanged
              ? "courseAuthoring.reviewMode.hideUnchangedQuestions"
              : "courseAuthoring.reviewMode.showUnchangedQuestions",
            { count: unchangedCount },
          )}
        </button>
      )}
    </div>
  );
};
