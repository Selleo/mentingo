import { MultiSelect } from "~/modules/Courses/Lesson/Question/MultipleChoice/MultiSelect";

import { getOptionConfig } from "./utils";

import type { QuizQuestionOption } from "../types";

type MultipleChoiceQuestionListProps = {
  options: QuizQuestionOption[];
  questionId: string;
  isPreviewMode: boolean;
  isCompleted: boolean;
  withPicture?: boolean;
};

export const MultipleChoiceOptionList = ({
  options,
  questionId,
  isPreviewMode,
  isCompleted,
  withPicture = false,
}: MultipleChoiceQuestionListProps) => (
  <>
    {options.map((option) => (
      <MultiSelect
        key={option.id}
        answer={option.optionText}
        answerId={option.id}
        questionId={questionId}
        isCompleted={isCompleted}
        isStudentAnswer={Boolean(option.isStudentAnswer)}
        optionFieldId={withPicture ? "photoQuestionMultipleChoice" : "multiAnswerQuestions"}
        {...getOptionConfig(option, isPreviewMode)}
      />
    ))}
  </>
);
