import * as Accordion from "@radix-ui/react-accordion";
import { ASSESSMENT_SCORING_MODES, type AssessmentScoringMode } from "@repo/shared";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList";
import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { DeleteContentType } from "~/modules/Admin/EditCourse/EditCourse.types";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { findBaseLanguageOption } from "../quizTranslationPlaceholders";

import type { Question, QuestionOption } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { KeyboardEvent } from "react";
import type { UseFormReturn } from "react-hook-form";

// Pair sides are single-line labels; the textarea only exists to show long text wrapped.
const preventNewLine = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (event.key === "Enter") event.preventDefault();
};

type MatchingQuestionProps = {
  form: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
  isStructureLocked?: boolean;
  baseLanguageQuestion?: Question;
};

const MatchingQuestion = ({
  form,
  questionIndex,
  isStructureLocked = false,
  baseLanguageQuestion,
}: MatchingQuestionProps) => {
  const watchedOptions = form.watch(`questions.${questionIndex}.options`);
  const scoringMode =
    form.watch(`questions.${questionIndex}.scoringMode`) ?? ASSESSMENT_SCORING_MODES.ALL_OR_NOTHING;
  const errors = form.formState.errors;
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleAddOption = useCallback(() => {
    if (isStructureLocked) return;

    const currentOptions: QuestionOption[] =
      form.getValues(`questions.${questionIndex}.options`) || [];

    const newOption: QuestionOption = {
      sortableId: crypto.randomUUID(),
      optionText: "",
      matchedWord: "",
      isCorrect: true,
      displayOrder: currentOptions.length + 1,
    };

    form.setValue(`questions.${questionIndex}.options`, [...currentOptions, newOption], {
      shouldDirty: true,
    });
  }, [form, questionIndex, isStructureLocked]);

  const handleRemoveOption = useCallback(
    (optionIndex: number) => {
      if (isStructureLocked) return;

      const currentOptions: QuestionOption[] =
        form.getValues(`questions.${questionIndex}.options`) || [];
      const updatedOptions = currentOptions.filter((_, index) => index !== optionIndex);
      form.setValue(`questions.${questionIndex}.options`, updatedOptions, { shouldDirty: true });
    },
    [form, questionIndex, isStructureLocked],
  );

  const handleRemoveQuestion = useCallback(() => {
    if (isStructureLocked) return;

    const currentQuestions = form.getValues("questions") || [];
    const updatedQuestions = currentQuestions.filter((_, index) => index !== questionIndex);
    form.setValue("questions", updatedQuestions, { shouldDirty: true });
  }, [form, questionIndex, isStructureLocked]);

  const handleOptionChange = useCallback(
    (optionIndex: number, field: "optionText" | "matchedWord", value: string) => {
      const currentOptions: QuestionOption[] =
        form.getValues(`questions.${questionIndex}.options`) || [];
      const updatedOptions = [...currentOptions];

      updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], [field]: value };
      form.setValue(`questions.${questionIndex}.options`, updatedOptions, { shouldDirty: true });
    },
    [form, questionIndex],
  );

  const onDeleteQuestion = () => {
    handleRemoveQuestion();
    setIsDeleteModalOpen(false);
  };

  const isOptionEmpty =
    !Array.isArray(form.getValues(`questions.${questionIndex}.options`)) ||
    form.getValues(`questions.${questionIndex}.options`)?.length === 0;

  return (
    <Accordion.Root key={questionIndex} type="single" collapsible>
      <Accordion.Item value={`item-${questionIndex}`}>
        <div className="mt-3 rounded-xl border-0 p-2 transition-all duration-300">
          <div className="sm:ml-14 mb-4 flex max-w-sm flex-col gap-2">
            <Label className="body-sm-md">
              {t("adminCourseView.curriculum.lesson.field.matchingScoring")}
            </Label>
            <Select
              value={scoringMode}
              disabled={isStructureLocked}
              onValueChange={(value) =>
                form.setValue(
                  `questions.${questionIndex}.scoringMode`,
                  value as AssessmentScoringMode,
                  { shouldDirty: true },
                )
              }
            >
              <SelectTrigger
                data-testid={QUIZ_LESSON_FORM_HANDLES.matchingScoringSelect(questionIndex)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ASSESSMENT_SCORING_MODES.ALL_OR_NOTHING}>
                  {t("adminCourseView.curriculum.lesson.other.matchingScoringAllOrNothing")}
                </SelectItem>
                <SelectItem value={ASSESSMENT_SCORING_MODES.PARTIAL}>
                  {t("adminCourseView.curriculum.lesson.other.matchingScoringPartial")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:ml-14">
            {!isOptionEmpty && (
              <>
                <span className="mr-1 text-red-500">*</span>
                <Label className="body-sm-md">
                  {t("adminCourseView.curriculum.lesson.field.options")}
                </Label>
              </>
            )}
            {watchedOptions && watchedOptions.length > 0 && (
              <SortableList
                items={watchedOptions}
                onChange={(updatedItems) => {
                  if (isStructureLocked) return;
                  form.setValue(`questions.${questionIndex}.options`, updatedItems, {
                    shouldDirty: true,
                  });
                }}
                className="grid grid-cols-1"
                renderItem={(item, index: number) => {
                  const baseLanguageOption = findBaseLanguageOption(
                    baseLanguageQuestion,
                    watchedOptions,
                    item,
                    index,
                  );
                  const optionError =
                    errors?.questions?.[questionIndex]?.options?.[index]?.optionText?.message;

                  return (
                    <SortableList.Item id={item.sortableId}>
                      <div className="mt-2">
                        <div className="flex items-center space-x-2 rounded-xl border border-neutral-200 p-2 pr-3">
                          {!isStructureLocked && (
                            <SortableList.DragHandle>
                              <Icon
                                name="DragAndDropIcon"
                                className="cursor-move sm:ml-4 sm:mr-3"
                              />
                            </SortableList.DragHandle>
                          )}
                          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
                            <AutosizeTextarea
                              minRows={1}
                              maxRows={6}
                              onKeyDown={preventNewLine}
                              name={`questions.${questionIndex}.options.${index}.optionText`}
                              data-testid={QUIZ_LESSON_FORM_HANDLES.matchingPromptInput(
                                questionIndex,
                                index,
                              )}
                              value={item.optionText}
                              onChange={(event) =>
                                handleOptionChange(index, "optionText", event.target.value)
                              }
                              placeholder={
                                baseLanguageOption?.optionText ||
                                t("adminCourseView.curriculum.lesson.placeholder.option")
                              }
                              className="min-h-10 w-full text-base sm:w-1/2"
                            />
                            <AutosizeTextarea
                              minRows={1}
                              maxRows={6}
                              onKeyDown={preventNewLine}
                              name={`questions.${questionIndex}.options.${index}.matchedWord`}
                              data-testid={QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(
                                questionIndex,
                                index,
                              )}
                              value={item.matchedWord}
                              onChange={(event) =>
                                handleOptionChange(index, "matchedWord", event.target.value)
                              }
                              placeholder={
                                baseLanguageOption?.matchedWord ||
                                t("adminCourseView.curriculum.lesson.placeholder.matchedWords")
                              }
                              className="min-h-10 w-full text-base sm:w-1/2"
                            />
                          </div>
                          <div className="flex items-center">
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                {!isStructureLocked && (
                                  <TooltipTrigger asChild>
                                    <div className="group">
                                      <Icon
                                        name="TrashIcon"
                                        className="size-7 cursor-pointer sm:ml-3 rounded-lg bg-error-50 p-1 text-error-500 group-hover:bg-error-600 group-hover:text-white"
                                        onClick={() => handleRemoveOption(index)}
                                      />
                                    </div>
                                  </TooltipTrigger>
                                )}
                                <TooltipContent
                                  side="top"
                                  align="center"
                                  className="ml-4 rounded bg-black text-sm text-white shadow-md"
                                >
                                  {t("common.button.delete")}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>
                      {optionError && (
                        <p className="ml-16 mt-1 text-sm text-red-500">{optionError}</p>
                      )}
                    </SortableList.Item>
                  );
                }}
              />
            )}
          </div>
          {errors?.questions?.[questionIndex] && (
            <p className="sm:ml-14 text-sm text-red-500">
              {errors?.questions?.[questionIndex]?.options?.message}
            </p>
          )}
          {!isStructureLocked && (
            <div className="sm:ml-14 mt-4 flex gap-2">
              <Button
                type="button"
                data-testid={QUIZ_LESSON_FORM_HANDLES.addOptionButton(questionIndex)}
                className="bg-primary-700"
                onClick={handleAddOption}
              >
                {t("adminCourseView.curriculum.lesson.button.addOption")}
              </Button>
              <Button
                type="button"
                className="bg-color-white border border-neutral-300 text-error-700"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                {t("adminCourseView.curriculum.lesson.button.deleteQuestion")}
              </Button>
            </div>
          )}
          <DeleteConfirmationModal
            open={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onDelete={onDeleteQuestion}
            contentType={DeleteContentType.QUESTION}
          />
        </div>
      </Accordion.Item>
    </Accordion.Root>
  );
};

export default MatchingQuestion;
