import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import type { QuizQuestion } from "~/modules/Courses/Lesson/Question/types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

export type DetailedResponseProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};
export const DetailedResponse = ({ question, isCompleted = false }: DetailedResponseProps) => {
  const { isPreviewMode } = useCourseAccessProvider();
  const { register } = useFormContext<QuizForm>();
  const { t } = useTranslation();

  return (
    <QuestionCard
      title={question.title}
      questionType="threeOrFiveWordSentence"
      questionNumber={question.displayOrder}
    >
      <Textarea
        data-testid="detailed-response"
        {...register(`detailedResponses.${question.id}`)}
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
