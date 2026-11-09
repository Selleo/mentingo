import { uniq } from "lodash-es";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";

import { QuestionCard } from "./QuestionCard";

import type { QuizQuestion } from "./types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type MatchingProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const Matching = ({ question, isCompleted = false }: MatchingProps) => {
  const { control } = useFormContext<QuizForm>();
  const { t } = useTranslation();
  const { isQuizFeedbackRedacted, isQuizSubmitted } = useQuizContext();
  // Radix Select rejects empty values, which untranslated pairs can have.
  const targets = uniq(question.matchingTargets ?? []).filter(Boolean);
  const showFeedback = isCompleted && !isQuizFeedbackRedacted;

  return (
    <QuestionCard
      title={question.title ?? ""}
      questionType="matching"
      questionNumber={question.displayOrder ?? 0}
    >
      {question.options?.map(({ id, optionText, isCorrect, matchedWord }) => (
        <div
          key={id}
          className={cn(
            "body-base flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 text-neutral-950 sm:flex-row sm:items-center",
            {
              "border-neutral-400 bg-neutral-100": isQuizFeedbackRedacted && isQuizSubmitted,
              "border-success-700 bg-success-50": showFeedback && isCorrect,
              "border-error-700 bg-error-50": showFeedback && !isCorrect,
            },
          )}
        >
          <span id={`matching-${id}`} className="w-full">
            {optionText}
          </span>
          <div className="flex w-full flex-col gap-1">
            <Controller
              control={control}
              name={`matchingQuestions.${question.id}.${id}`}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={isCompleted}
                >
                  <SelectTrigger aria-labelledby={`matching-${id}`} className="bg-white">
                    <SelectValue placeholder={t("studentLessonView.other.selectMatch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((target) => (
                      <SelectItem key={target} value={target}>
                        {target}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {showFeedback && !isCorrect && matchedWord && (
              <span className="body-sm text-neutral-800">
                {t("studentLessonView.other.correctMatch")} {matchedWord}
              </span>
            )}
          </div>
        </div>
      ))}
    </QuestionCard>
  );
};
