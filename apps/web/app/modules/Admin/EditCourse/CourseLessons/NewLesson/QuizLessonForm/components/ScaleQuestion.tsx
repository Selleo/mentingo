import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { SortableList } from "~/components/SortableList";
import { Accordion, AccordionItem } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { DeleteContentType } from "~/modules/Admin/EditCourse/EditCourse.types";

import { findBaseLanguageOption } from "../quizTranslationPlaceholders";

import type { Question, QuestionOption } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type ScaleQuestionProps = {
  form: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
  isStructureLocked?: boolean;
  baseLanguageQuestion?: Question;
};

const ScaleQuestion = ({
  form,
  questionIndex,
  isStructureLocked = false,
  baseLanguageQuestion,
}: ScaleQuestionProps) => {
  const watchedOptions = form.watch(`questions.${questionIndex}.options`);
  const errors = form.formState.errors;
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

                  return (
                    <SortableList.Item id={item.sortableId}>
                      <div className="mt-2 flex items-center space-x-2 rounded-xl border border-neutral-200 p-2 pr-3">
                        <div className="flex w-full items-center gap-2">
                          <Input
                            type="text"
                            name={`questions.${questionIndex}.options.${index}.optionText`}
                            value={item.optionText}
                            onChange={(e) =>
                              handleOptionChange(index, "optionText", e.target.value)
                            }
                            placeholder={baseLanguageOption?.optionText || `${index + 1}`}
                            required
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </SortableList.Item>
                  );
                }}
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
