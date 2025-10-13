import { AccordionTrigger } from "@radix-ui/react-accordion";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Input } from "~/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

import { mapQuestionTypeToLabel } from "../../../CourseLessons.helpers";
import { QuestionIcons, QuestionType } from "../QuizLessonForm.types";

import type { Question } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

interface QuestionTitleProps {
  questionIndex: number;
  questionType: QuestionType;
  form: UseFormReturn<QuizLessonFormValues>;
  isOpen?: boolean;
  handleToggle?: () => void;
  dragTrigger?: React.ReactNode;
  item: Question;
  isOpenQuestion: boolean;
}

const QuestionTitle = ({
  questionIndex,
  questionType,
  form,
  isOpen,
  handleToggle,
  dragTrigger,
  item,
  isOpenQuestion,
}: QuestionTitleProps) => {
  const questionTypeToIconMap: Record<QuestionType, QuestionIcons> = {
    [QuestionType.MULTIPLE_CHOICE]: QuestionIcons.MultiSelect,
    [QuestionType.SINGLE_CHOICE]: QuestionIcons.SingleSelect,
    [QuestionType.TRUE_OR_FALSE]: QuestionIcons.TrueOrFalse,
    [QuestionType.BRIEF_RESPONSE]: QuestionIcons.BriefResponse,
    [QuestionType.DETAILED_RESPONSE]: QuestionIcons.DetailedResponse,
    [QuestionType.PHOTO_QUESTION_SINGLE_CHOICE]: QuestionIcons.PhotoQuestion,
    [QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE]: QuestionIcons.PhotoQuestion,
    [QuestionType.FILL_IN_THE_BLANKS_TEXT]: QuestionIcons.GapFill,
    [QuestionType.FILL_IN_THE_BLANKS_DND]: QuestionIcons.FillInTheBlanks,
    [QuestionType.MATCH_WORDS]: QuestionIcons.MatchWords,
    [QuestionType.SCALE_1_5]: QuestionIcons.Scale_1_5,
  };

  const getIconForQuestionType = (type: QuestionType): QuestionIcons => {
    return questionTypeToIconMap[type];
  };

  const { t } = useTranslation();

  const handleRemoveQuestion = useCallback(() => {
    const currentQuestions = form.getValues("questions") || [];
    const updatedQuestions = currentQuestions.filter((_, index) => index !== questionIndex);
    form.setValue("questions", updatedQuestions, { shouldDirty: true });
  }, [form, questionIndex]);

  const handleOptionChange = useCallback(
    (value: string) => {
      form.setValue(`questions.${questionIndex}.title`, value, { shouldDirty: true });
    },
    [form, questionIndex],
  );

  return (
    <div className="flex items-center gap-2 border-neutral-200 p-2">
      {dragTrigger}
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="group">
              <Icon
                name={getIconForQuestionType(questionType)}
                className="size-5 text-primary-700"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="ml-4 rounded bg-black text-sm text-white shadow-md"
          >
            {t(mapQuestionTypeToLabel(questionType))}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Input
        type="text"
        name={`questions.${questionIndex}.title`}
        value={item.title}
        onChange={(e) => handleOptionChange(e.target.value)}
        required
        className="flex-1"
      />
      {isOpenQuestion && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="group">
                <Icon
                  name="TrashIcon"
                  className="ml-3 size-7 cursor-pointer rounded-lg bg-error-50 p-1 text-error-500 group-hover:bg-error-600 group-hover:text-white"
                  onClick={handleRemoveQuestion}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="center"
              className="ml-4 rounded bg-black text-sm text-white shadow-md"
            >
              {t("common.button.delete")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {handleToggle && !isOpenQuestion && (
        <AccordionTrigger className="ml-2 mr-2 text-primary-800" onClick={handleToggle}>
          <Icon name={!isOpen ? "ArrowDown" : "ArrowUp"} />
        </AccordionTrigger>
      )}
    </div>
  );
};

export default QuestionTitle;
