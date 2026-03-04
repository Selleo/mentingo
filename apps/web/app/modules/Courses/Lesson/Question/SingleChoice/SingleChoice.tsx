import { useCourseExperience } from "~/modules/Courses/context/CourseExperienceContext";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import { SingleChoiceOptionList } from "./SingleChoiceOptionList";

import type { QuizQuestion } from "../types";

type SingleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const SingleChoice = ({ question, isCompleted = false }: SingleChoiceProps) => {
  const { isPreviewMode } = useCourseExperience();

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
