import { useUserRole } from "~/hooks/useUserRole";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import { SingleChoiceOptionList } from "./SingleChoiceOptionList";

import type { QuizQuestion } from "../types";

type SingleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const SingleChoice = ({ question, isCompleted = false }: SingleChoiceProps) => {
  const { isAdmin } = useUserRole();

  return (
    <QuestionCard
      title={question.title}
      questionType="singleChoice"
      questionNumber={question.displayOrder}
      data-testid="single-choice"
    >
      <SingleChoiceOptionList
        options={question.options || []}
        questionId={question.id}
        isAdmin={isAdmin}
        isCompleted={isCompleted}
      />
    </QuestionCard>
  );
};
