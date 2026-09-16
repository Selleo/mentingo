import { Question } from "app/modules/Courses/Lesson/Question";

import { useQuizContext } from "../components/QuizContextProvider";

import type { GetLessonByIdResponse } from "~/api/generated-api";

type Questions = NonNullable<GetLessonByIdResponse["data"]["quizDetails"]>["questions"];

type QuestionsProps = {
  questions: Questions;
  isQuizCompleted?: boolean;
  lessonId: string;
};

export const Questions = ({ questions, isQuizCompleted = false, lessonId }: QuestionsProps) => {
  const { isQuizFeedbackRedacted } = useQuizContext();
  return questions.map((question: Questions[number]) => {
    if (!question) return null;

    return (
      <div key={question.id}>
        <Question question={question} isCompleted={isQuizCompleted} lessonId={lessonId} />
        {isQuizCompleted && !isQuizFeedbackRedacted && question.feedback && (
          <p className="mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-3 text-sm">
            {question.feedback}
          </p>
        )}
      </div>
    );
  });
};
