import { useUserRole } from "~/hooks/useUserRole";
import { MultipleChoiceOptionList } from "~/modules/Courses/Lesson/Question/MultipleChoice/MultipleChoiceOptionList";

import { QuestionCard } from "../QuestionCard";

import type { QuizQuestion } from "../types";

type PhotoQuestionMultipleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const PhotoQuestionMultipleChoice = ({
  question,
  isCompleted = false,
}: PhotoQuestionMultipleChoiceProps) => {
  const { isAdmin } = useUserRole();

  return (
    <QuestionCard
      title={question.title}
      questionType="singleChoice"
      questionNumber={question.displayOrder}
    >
      <img
        src={question.photoS3Key || "https://placehold.co/960x620/png"}
        alt=""
        className="h-auto w-full max-w-[960px] rounded-lg"
      />
      <MultipleChoiceOptionList
        options={question.options ?? []}
        questionId={question.id}
        isCompleted={isCompleted}
        isAdmin={isAdmin}
        withPicture
      />
    </QuestionCard>
  );
};
