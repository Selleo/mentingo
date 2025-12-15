import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList";
import { Accordion, AccordionItem } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { DeleteContentType } from "~/modules/Admin/EditCourse/EditCourse.types";

import type { QuestionOption } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type ScaleQuestionProps = {
  form: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
  isStructureLocked?: boolean;
};

const ScaleQuestion = ({ form, questionIndex, isStructureLocked = false }: ScaleQuestionProps) => {
  const watchedOptions = form.watch(`questions.${questionIndex}.options`);
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
      isCorrect: false,
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
    (optionIndex: number, field: "optionText" | "scaleAnswer", value: string | number) => {
      if (isStructureLocked && field === "scaleAnswer") return;

      const currentOptions: QuestionOption[] =
        form.getValues(`questions.${questionIndex}.options`) || [];
      const updatedOptions = [...currentOptions];

      updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], [field]: value };
      form.setValue(`questions.${questionIndex}.options`, updatedOptions, { shouldDirty: true });
    },
    [form, questionIndex, isStructureLocked],
  );

  const onDeleteQuestion = () => {
    handleRemoveQuestion();
    setIsDeleteModalOpen(false);
  };

  const isOptionEmpty =
    !Array.isArray(form.getValues(`questions.${questionIndex}.options`)) ||
    form.getValues(`questions.${questionIndex}.options`)?.length === 0;

  return (
    <Accordion key={questionIndex} type="single" collapsible>
      <AccordionItem value={`item-${questionIndex}`}>
        <div className="mt-3 rounded-xl border-0 p-2 transition-all duration-300">
          <div className="ml-14">
            {!isOptionEmpty ? (
              <>
                <span className="mr-1 text-red-500">*</span>
                <Label className="body-sm-md">
                  {t("adminCourseView.curriculum.lesson.field.options")}
                </Label>
              </>
            ) : null}
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
                renderItem={(item, index: number) => (
                  <SortableList.Item id={item.sortableId}>
                    <div className="mt-2 flex items-center space-x-2 rounded-xl border border-neutral-200 p-2 pr-3">
                      {!isStructureLocked && (
                        <SortableList.DragHandle>
                          <Icon name="DragAndDropIcon" className="ml-4 mr-3 cursor-move" />
                        </SortableList.DragHandle>
                      )}
                      <div className="flex w-full items-center gap-2">
                        <Input
                          type="text"
                          name={`questions.${questionIndex}.options.${index}.optionText`}
                          value={item.optionText}
                          onChange={(e) => handleOptionChange(index, "optionText", e.target.value)}
                          placeholder={`${t("adminCourseView.curriculum.lesson.placeholder.option")} ${index + 1}`}
                          required
                          className="flex-1"
                        />
                        {/* This code is currently commented out temporarily */}
                        {/* <div className="w-[10%]">
                            <Select
                              name={`questions.${questionIndex}.options.${index}.scaleAnswer`}
                              value={form
                                .getValues(
                                  `questions.${questionIndex}.options.${index}.scaleAnswer`,
                                )
                                ?.toString()}
                              onValueChange={(value) =>
                                handleOptionChange(index, "scaleAnswer", Number(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  className="text-left body-base-md"
                                  placeholder={`Scale`}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5].map((option) => (
                                  <SelectItem key={option} value={option.toString()}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div> */}
                        <div className="flex items-center">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              {!isStructureLocked && (
                                <TooltipTrigger asChild>
                                  <div className="group">
                                    <Icon
                                      name="TrashIcon"
                                      className="ml-3 size-7 cursor-pointer rounded-lg bg-error-50 p-1 text-error-500 group-hover:bg-error-600 group-hover:text-white"
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
                  </SortableList.Item>
                )}
              />
            )}
          </div>
          {errors?.questions?.[questionIndex] && (
            <p className="ml-14 text-sm text-red-500">
              {errors?.questions?.[questionIndex]?.options?.message}
            </p>
          )}
          {!isStructureLocked && (
            <div className="ml-14 mt-4 flex gap-2">
              <Button
                type="button"
                data-testid={`add-options-button-${questionIndex}`}
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
      </AccordionItem>
    </Accordion>
  );
};

export default ScaleQuestion;
