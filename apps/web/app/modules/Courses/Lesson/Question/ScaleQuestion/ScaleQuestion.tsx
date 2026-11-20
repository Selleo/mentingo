import { useId } from "react";

import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";
import { ScaleQuestionOptionsList } from "~/modules/Courses/Lesson/Question/ScaleQuestion/ScaleQuestionOptionsList";

import type { QuizQuestion } from "../types";

type ScaleQuestionProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const ScaleQuestion = ({ question, isCompleted = false }: ScaleQuestionProps) => {
  const { isPreviewMode } = useCourseAccessProvider();
  const titleId = useId();

  return (
    <QuestionCard
      title={question.title}
      questionType="scale_1_5"
      questionNumber={question.displayOrder}
      titleId={titleId}
    >
      <ScaleQuestionOptionsList
        options={question.options || []}
        questionId={question.id}
        labelledBy={titleId}
        isCompleted={isCompleted}
        isPreviewMode={isPreviewMode}
      />
    </QuestionCard>
  );
};
