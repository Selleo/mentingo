import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { SELECT_OPTION_VARIANTS } from "~/modules/Courses/Lesson/constants";

import type { QuizForm } from "~/modules/Courses/Lesson/types";

type SelectAnswerOptionQuizProps = {
  answer: string | null;
  answerId: string;
  isCorrectAnswer?: boolean | null;
  isCorrectAnswerNotSelected?: boolean | null;
  isFieldDisabled: boolean;
  isCompleted: boolean;
  isStudentAnswer: boolean;
  isWrongAnswer: boolean;
  questionId: string;
  optionFieldId?: "singleAnswerQuestions" | "photoQuestionSingleChoice";
  isPreviewMode: boolean;
};

export const SingleSelect = ({
  answer,
  answerId,
  isCorrectAnswer,
  isCorrectAnswerNotSelected,
  isFieldDisabled,
  isCompleted,
  isStudentAnswer,
  isWrongAnswer,
  questionId,
  optionFieldId = "singleAnswerQuestions",
  isPreviewMode,
}: SelectAnswerOptionQuizProps) => {
  const { register, setValue, getValues } = useFormContext<QuizForm>();
  const { t } = useTranslation();
  const getAnswerClasses = () => {
    if (isCorrectAnswer === null) return SELECT_OPTION_VARIANTS.default;

    if (isCorrectAnswer || isCorrectAnswerNotSelected) {
      return SELECT_OPTION_VARIANTS.correctAnswerSelected;
    }

    if (isWrongAnswer) {
      return SELECT_OPTION_VARIANTS.incorrectAnswerSelected;
    }

    return SELECT_OPTION_VARIANTS.default;
  };

  const classes = getAnswerClasses();

  const isInputToggleHidden =
    (isCompleted && !isStudentAnswer && isCorrectAnswerNotSelected) ||
    (isCompleted &&
      isStudentAnswer &&
      (isCorrectAnswerNotSelected || isWrongAnswer || isCorrectAnswer));

  return (
    <label
      htmlFor={answerId}
      className={cn(
        "flex items-center space-x-3 rounded-lg border border-primary-200 px-4 py-3 *:cursor-pointer",
        { "pointer-events-none cursor-not-allowed": isFieldDisabled },
        classes,
      )}
    >
      <Input
        className={cn("size-4", {
          "not-sr-only": !isCompleted,
          "sr-only": isInputToggleHidden,
        })}
        id={answerId}
        readOnly
        type="radio"
        value={answerId}
        {...register(`${optionFieldId}.${questionId}.${answerId}`)}
        onChange={(event) => {
          const { singleAnswerQuestions, photoQuestionSingleChoice } = getValues();

          const answersByFieldId =
            optionFieldId === "singleAnswerQuestions"
              ? singleAnswerQuestions
              : photoQuestionSingleChoice;

          const updatedAnswers = Object.keys(answersByFieldId[questionId]).reduce<
            Record<string, string | null>
          >((acc, key) => {
            if (key === answerId) {
              acc[key] = event.target.value;

              return acc;
            }

            acc[key] = null;

            return acc;
          }, {});

          setValue(`${optionFieldId}.${questionId}`, updatedAnswers);
        }}
        onBlur={undefined}
      />
      <Icon
        name={
          isCorrectAnswer || isCorrectAnswerNotSelected
            ? "InputRoundedMarkerSuccess"
            : "InputRoundedMarkerError"
        }
        className={cn("!ml-0", {
          "sr-only": !isCompleted || (!isCorrectAnswerNotSelected && !isStudentAnswer),
        })}
      />
      <Label
        className="body-base flex w-full justify-between text-start font-normal text-neutral-950"
        htmlFor={answerId}
        onClick={(e) => e.stopPropagation()}
      >
        <span>{answer}</span>
        <span className={classes}>
          {isStudentAnswer &&
            isCompleted &&
            (isPreviewMode
              ? t("studentCourseView.lesson.studentsAnswer")
              : t("studentCourseView.lesson.yourAnswer"))}
        </span>
      </Label>
    </label>
  );
};
