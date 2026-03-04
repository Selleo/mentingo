import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import { MultipleChoiceOptionList } from "./MultipleChoiceOptionList";

import type { QuizQuestion } from "../types";

type MultipleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const MultipleChoice = ({ question, isCompleted = false }: MultipleChoiceProps) => {
  const { isPreviewMode } = useCourseAccessProvider();

  return (
    <QuestionCard
      title={question.title}
      questionType="multipleChoice"
      questionNumber={question.displayOrder}
    >
      <MultipleChoiceOptionList
        options={question.options ?? []}
        questionId={question.id}
        isCompleted={isCompleted}
        isPreviewMode={isPreviewMode}
      />
    </QuestionCard>
  );
};
