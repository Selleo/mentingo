import { QuestionCard } from "../QuestionCard";

import { ScaleOptionList } from "./ScaleOptionList";

import type { QuizQuestion } from "../types";

type ScaleProps = {
  question: QuizQuestion;
  isCompleted: boolean;
};

export const Scale = ({ question, isCompleted }: ScaleProps) => {
  return (
    <QuestionCard
      title={question.title}
      questionType="scale"
      questionNumber={question.displayOrder}
    >
      <ScaleOptionList
        options={question.options ?? []}
        questionId={question.id}
        isCompleted={isCompleted}
      />
    </QuestionCard>
  );
};
