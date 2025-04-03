import { useUserRole } from "~/hooks/useUserRole";

import { QuestionCard } from "../QuestionCard";
import { SingleChoiceOptionList } from "../SingleChoice/SingleChoiceOptionList";

import type { QuizQuestion } from "../types";

type PhotoQuestionSingleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const PhotoQuestionSingleChoice = ({
  question,
  isCompleted = false,
}: PhotoQuestionSingleChoiceProps) => {
  const { isAdmin } = useUserRole();

  return (
    <QuestionCard
      title={question.title}
      questionType="singleChoice"
      questionNumber={question.displayOrder}
      data-testid="photo-question-single-choice"
    >
      <img
        src={question.photoS3Key || "https://placehold.co/960x620/png"}
        alt=""
        className="h-auto w-full max-w-[960px] rounded-lg"
      />
      <SingleChoiceOptionList
        options={question.options || []}
        questionId={question.id}
        isAdmin={isAdmin}
        isCompleted={isCompleted}
        withPicture
      />
    </QuestionCard>
  );
};
