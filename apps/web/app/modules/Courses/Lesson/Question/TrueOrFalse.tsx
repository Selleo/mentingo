import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

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

  console.log(question);
  return (
    <QuestionCard
      title={question.title ?? ""}
      questionType="trueOrFalseQuestion"
      questionNumber={question.displayOrder ?? 0}
    >
      {question.options?.map(
        ({ optionText, id, isCorrect, studentAnswer = false, isStudentAnswer }, index) => (
          <div
            key={index}
            className={cn(
              "body-base flex w-full gap-x-4 rounded-lg border border-neutral-200 px-4 py-3 text-neutral-950 flex-col sm:flex-row",
              {
                "border-success-700 bg-success-50": isCorrect && isStudentAnswer,
                "border-error-700 bg-error-50":
                  (!isCorrect && isStudentAnswer && isCompleted) ||
                  (!isCorrect && !isStudentAnswer && isCompleted) ||
                  (isCorrect && !isStudentAnswer && isCompleted),
                "has-[input:checked]:bg-primary-50 [&]:has-[input:checked]:border-primary-500":
                  !isCompleted,
                "pointer-events-none": isCompleted,
              },
            )}
          >
            <div className="w-full">{optionText}</div>
            <div className="flex gap-x-4">
              <label className="flex items-center gap-x-1">
                <Input
                  className="size-4"
                  {...(studentAnswer === "true" && { checked: true })}
                  type="radio"
                  value="true"
                  {...register(`trueOrFalseQuestions.${question.id}.${id}`)}
                  name={`trueOrFalseQuestions.${question.id}.${id}`}
                />
                {t("studentLessonView.other.true")}
              </label>
              <label className="flex items-center gap-x-1">
                <Input
                  className="size-4"
                  {...(studentAnswer === "false" && { checked: true })}
                  {...register(`trueOrFalseQuestions.${question.id}.${id}`)}
                  name={`trueOrFalseQuestions.${question.id}.${id}`}
                  type="radio"
                  value="false"
                />
                {t("studentLessonView.other.false")}
              </label>
            </div>
          </div>
        ),
      )}
    </QuestionCard>
  );
};
