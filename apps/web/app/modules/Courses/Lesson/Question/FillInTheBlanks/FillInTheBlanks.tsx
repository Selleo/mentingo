import { useTranslation } from "react-i18next";

import Viewer from "~/components/RichText/Viever";
import { Card } from "~/components/ui/card";
import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";

import { FillInTheTextBlanks } from "./FillInTheTextBlanks";
import { TextBlank } from "./TextBlank";

import type { QuizQuestion } from "../types";

type FillInTheBlanksProps = {
  question: QuizQuestion;
  isCompleted: boolean;
};

export const FillInTheBlanks = ({ question, isCompleted }: FillInTheBlanksProps) => {
  const { t } = useTranslation();
  const { isQuizFeedbackRedacted } = useQuizContext();

  if (!question.description) return null;

  return (
    <Card className="flex flex-col gap-4 border-neutral-200 p-8">
      <div className="details uppercase text-primary-700">
        {t("studentLessonView.other.question")} {question.displayOrder}
      </div>
      <div className="h6 text-neutral-950">{t("studentLessonView.other.fillInTheBlanks")}</div>
      <FillInTheTextBlanks
        content={question.description}
        replacement={(index) => {
          return (
            <TextBlank
              questionId={question.id}
              studentAnswer={question.options?.[index]}
              index={index}
              isQuizSubmitted={isCompleted}
            />
          );
        }}
      />
      {isCompleted && !!question?.solutionExplanation && !isQuizFeedbackRedacted && (
        <div>
          <span className="body-base-md text-error-700">Correct sentence:</span>
          <Viewer content={question.solutionExplanation} />
        </div>
      )}
    </Card>
  );
};
