import { useFormContext } from "react-hook-form";

import { Textarea } from "~/components/ui/textarea";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import type { QuizQuestion } from "~/modules/Courses/Lesson/Question/types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

export type BriefResponseProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const BriefResponse = ({ question, isCompleted = false }: BriefResponseProps) => {
  const { isAdmin } = useUserRole();
  const { register } = useFormContext<QuizForm>();

  return (
    <QuestionCard
      title={question.title}
      questionType="oneOrTwoWordSentence"
      questionNumber={question.displayOrder}
    >
      <Textarea
        data-testid="brief-response"
        {...register(`briefResponses.${question.id}`)}
        placeholder="Type your answer here"
        rows={5}
        className={cn({
          "cursor-not-allowed": isAdmin,
          "pointer-events-none": isCompleted,
        })}
      />
    </QuestionCard>
  );
};
