import { useFormContext } from "react-hook-form";

import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { QuestionCard } from "../QuestionCard";

import type { QuizQuestion } from "../types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type ScaleQuestionProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const ScaleQuestion = ({ question, isCompleted }: ScaleQuestionProps) => {
  const { register, setValue, watch } = useFormContext<QuizForm>();

  const currentValue = watch(`scaleQuestions.${question.id}`);

  return (
    <QuestionCard
      title={question.title ?? ""}
      questionType="singleChoice"
      questionNumber={question.displayOrder ?? 0}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((scaleValue, index) => (
            <div key={index} className="flex flex-col items-center gap-3">
              <Label
                htmlFor={`scale-${question.id}-${scaleValue}`}
                className={cn(
                  "flex min-h-[70px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-all",
                  {
                    "border-primary-500 bg-primary-50": currentValue === String(scaleValue),
                    "border-neutral-200 hover:border-neutral-300":
                      currentValue !== String(scaleValue),
                    "pointer-events-none opacity-60": isCompleted,
                  },
                )}
                onClick={() =>
                  !isCompleted && setValue(`scaleQuestions.${question.id}`, String(scaleValue))
                }
              >
                <input
                  {...register(`scaleQuestions.${question.id}`)}
                  id={`scale-${question.id}-${scaleValue}`}
                  type="radio"
                  value={String(scaleValue)}
                  className="sr-only"
                />
                <span className="text-2xl font-bold">{index + 1}</span>
              </Label>
            </div>
          ))}
        </div>
      </div>
    </QuestionCard>
  );
};
