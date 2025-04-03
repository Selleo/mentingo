import { useTranslation } from "react-i18next";

import type { ReactNode } from "react";

type QuestionCardProps = {
  questionNumber: number | undefined;
  title: string | undefined;
  questionType:
    | "singleChoice"
    | "multipleChoice"
    | "trueOrFalseQuestion"
    | "oneOrTwoWordSentence"
    | "threeOrFiveWordSentence";
  children: ReactNode;
};

export const QuestionCard = ({
  children,
  questionNumber,
  questionType,
  title = "Question title not provided",
}: QuestionCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-8">
      <div className="details uppercase text-primary-700">
        {t("studentLessonView.other.question")} {questionNumber ?? 0}
      </div>
      <div className="h6 text-neutral-950" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="body-base text-neutral-900">
        {t(`studentCourseView.lesson.${questionType}`)}
      </div>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </div>
  );
};
