import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import type { QuizQuestion } from "~/modules/Courses/Lesson/Question/types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

export type BriefResponseProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const BriefResponse = ({ question, isCompleted = false }: BriefResponseProps) => {
  const { isPreviewMode } = useCourseAccessProvider();
  const { register } = useFormContext<QuizForm>();
  const { t } = useTranslation();

  return (
    <QuestionCard
      title={question.title}
      questionType="oneOrTwoWordSentence"
      questionNumber={question.displayOrder}
    >
      <Textarea
        data-testid="brief-response"
        {...register(`briefResponses.${question.id}`)}
        placeholder={t("studentLessonView.placeholder.openQuestion")}
        rows={5}
        className={cn({
          "cursor-not-allowed": isPreviewMode,
          "pointer-events-none": isCompleted,
        })}
      />
    </QuestionCard>
  );
};
