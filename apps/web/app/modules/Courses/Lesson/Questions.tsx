import { Question } from "app/modules/Courses/Lesson/Question";

import type { GetLessonByIdResponse } from "~/api/generated-api";

type Questions = NonNullable<GetLessonByIdResponse["data"]["quizDetails"]>["questions"];

type QuestionsProps = {
  questions: Questions;
  isQuizCompleted?: boolean;
  lessonId: string;
};

export const Questions = ({ questions, isQuizCompleted = false, lessonId }: QuestionsProps) => {
  return questions.map((question: Questions[number]) => {
    if (!question) return null;

    return (
      <Question
        key={question.id}
        question={question}
        isCompleted={isQuizCompleted}
        lessonId={lessonId}
      />
    );
  });
};
