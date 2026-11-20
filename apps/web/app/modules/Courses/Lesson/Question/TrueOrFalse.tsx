import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";
import { QUIZ_ANSWER_FOCUS_RING } from "~/modules/Courses/Lesson/constants";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import { QuestionCard } from "./QuestionCard";

import type { QuizQuestion } from "./types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type TrueOrFalseProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const TrueOrFalse = ({ question, isCompleted }: TrueOrFalseProps) => {
  const { register } = useFormContext<QuizForm>();
  const { t } = useTranslation();
  const { isQuizFeedbackRedacted, isQuizSubmitted } = useQuizContext();

  return (
    <QuestionCard
      title={question.title ?? ""}
      questionType="trueOrFalseQuestion"
      questionNumber={question.displayOrder ?? 0}
    >
      {question.options?.map(({ optionText, id, studentAnswer, isCorrect }, index) => {
        const isAnswered = studentAnswer === "true" || studentAnswer === "false";
        const isCorrectAnswer = isAnswered && studentAnswer === String(isCorrect);
        const showsFeedback = !isQuizFeedbackRedacted && isCompleted;
        const isCorrectCard = showsFeedback && isCorrectAnswer;
        const isWrongCard = showsFeedback && isAnswered && !isCorrectAnswer;
        // Browsers paint disabled native radios grey (and Input adds disabled:opacity-50), so review
        // mode draws its own radio; forced-colors mode keeps the native one, which the system colours correctly.
        const radioClassName = cn("size-4", {
          grayscale: isQuizFeedbackRedacted && isQuizSubmitted,
          "appearance-none rounded-full border-2 p-0 checked:shadow-[inset_0_0_0_2px_var(--color-white)] disabled:opacity-100 forced-colors:appearance-auto":
            isCompleted,
          "border-neutral-950 checked:bg-neutral-950":
            isCompleted && !isCorrectCard && !isWrongCard,
          "border-success-700 checked:bg-success-700": isCorrectCard,
          "border-error-700 checked:bg-error-700": isWrongCard,
        });
        const labelClassName = cn("flex items-center gap-x-1 rounded-sm", QUIZ_ANSWER_FOCUS_RING, {
          "text-success-700": isCorrectCard,
          "text-error-700": isWrongCard,
        });

        return (
          <div
            key={index}
            className={cn(
              "body-base flex w-full gap-x-4 rounded-lg border border-neutral-200 px-4 py-3 text-neutral-950 flex-col sm:flex-row",
              {
                "border-neutral-400 bg-neutral-100": isQuizFeedbackRedacted && isQuizSubmitted,
                "border-success-700 bg-success-50": isCorrectCard,
                "border-error-700 bg-error-50": isWrongCard,
                "has-[input:checked]:bg-primary-50 [&]:has-[input:checked]:border-primary-500":
                  !isCompleted,
                "pointer-events-none": isCompleted,
              },
            )}
          >
            <div id={`true-or-false-statement-${id}`} className="w-full">
              {optionText}
            </div>
            <div
              role="radiogroup"
              aria-labelledby={`true-or-false-statement-${id}`}
              className="flex gap-x-4"
            >
              <label className={labelClassName}>
                <Input
                  className={radioClassName}
                  type="radio"
                  value="true"
                  data-testid={LEARNING_HANDLES.trueOrFalseOption(id, "true")}
                  {...register(`trueOrFalseQuestions.${question.id}.${id}`)}
                  name={`trueOrFalseQuestions.${question.id}.${id}`}
                  disabled={isCompleted}
                />
                {t("studentLessonView.other.true")}
              </label>
              <label className={labelClassName}>
                <Input
                  className={radioClassName}
                  {...register(`trueOrFalseQuestions.${question.id}.${id}`)}
                  name={`trueOrFalseQuestions.${question.id}.${id}`}
                  disabled={isCompleted}
                  type="radio"
                  value="false"
                  data-testid={LEARNING_HANDLES.trueOrFalseOption(id, "false")}
                />
                {t("studentLessonView.other.false")}
              </label>
            </div>
          </div>
        );
      })}
    </QuestionCard>
  );
};
