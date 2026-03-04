import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import { SingleChoiceOptionList } from "./SingleChoiceOptionList";

import type { QuizQuestion } from "../types";

type SingleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const SingleChoice = ({ question, isCompleted = false }: SingleChoiceProps) => {
  const { isPreviewMode } = useCourseAccessProvider();

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
        isPreviewMode={isPreviewMode}
        isCompleted={isCompleted}
      />
    </QuestionCard>
  );
};
