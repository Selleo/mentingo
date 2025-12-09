import * as Accordion from "@radix-ui/react-accordion";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadFile } from "~/api/mutations/admin/useUploadFile";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
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
import { DeleteContentType, type Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

import { QuestionType } from "../QuizLessonForm.types";

import type { QuestionOption } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type PhotoQuestionProps = {
  form: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
  lessonToEdit: Lesson | null;
  isStructureLocked?: boolean;
};

const PhotoQuestion = ({
  form,
  questionIndex,
  lessonToEdit,
  isStructureLocked = false,
}: PhotoQuestionProps) => {
  const questionType = form.watch(`questions.${questionIndex}.type`);
  const [isUploading, setIsUploading] = useState(false);
  const { mutateAsync: uploadFile } = useUploadFile();
  const [displayImageUrl, setDisplayImageUrl] = useState<string | undefined>(undefined);
  const watchedOptions = form.watch(`questions.${questionIndex}.options`);
  const errors = form.formState.errors;
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    setDisplayImageUrl(lessonToEdit?.questions?.[questionIndex]?.photoS3SingedUrl);
  }, [lessonToEdit, questionIndex]);

  const isOptionEmpty =
    !Array.isArray(form.getValues(`questions.${questionIndex}.options`)) ||
    form.getValues(`questions.${questionIndex}.options`)?.length === 0;

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
      shouldValidate: true,
    });
  }, [form, questionIndex, isStructureLocked]);

  const handleRemoveOption = useCallback(
    (optionIndex: number) => {
      if (isStructureLocked) return;

      const currentOptions: QuestionOption[] =
        form.getValues(`questions.${questionIndex}.options`) || [];
      const updatedOptions = currentOptions.filter((_, index) => index !== optionIndex);
      form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form, questionIndex, isStructureLocked],
  );

  const handleRemoveQuestion = useCallback(() => {
    if (isStructureLocked) return;

    const currentQuestions = form.getValues("questions") || [];
    const updatedQuestions = currentQuestions.filter((_, index) => index !== questionIndex);
    form.setValue("questions", updatedQuestions, { shouldDirty: true, shouldValidate: true });
  }, [form, questionIndex, isStructureLocked]);

  const handleOptionChange = useCallback(
    (optionIndex: number, field: "optionText" | "isCorrect", value: string | boolean) => {
      if (isStructureLocked && field === "isCorrect") return;

      const currentOptions: QuestionOption[] =
        form.getValues(`questions.${questionIndex}.options`) || [];
      const updatedOptions = [...currentOptions];

      if (field === "isCorrect") {
        if (questionType === QuestionType.PHOTO_QUESTION_SINGLE_CHOICE) {
          updatedOptions.forEach((option, index) => {
            option.isCorrect = index === optionIndex;
          });
        } else if (questionType === QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE) {
          updatedOptions[optionIndex].isCorrect = value as boolean;
        }
      } else {
        updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], [field]: value as string };
      }

      form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form, questionIndex, questionType, isStructureLocked],
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (isStructureLocked) return;

      setIsUploading(true);
      try {
        const result = await uploadFile({ file, resource: "lesson" });
        setDisplayImageUrl(result.fileUrl);
        form.setValue(`questions.${questionIndex}.photoS3Key`, result.fileKey, {
          shouldValidate: true,
          shouldDirty: true,
        });
      } catch (error) {
        console.error("Error uploading image:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [form, uploadFile, questionIndex, isStructureLocked],
  );

  const onDeleteQuestion = () => {
    handleRemoveQuestion();
    setIsDeleteModalOpen(false);
  };

  return (
    <Accordion.Root key={questionIndex} type="single" collapsible>
      <Accordion.Item value={`item-${questionIndex}`}>
        <div className="mt-3 rounded-xl border-0 p-2 transition-all duration-300">
          <div className="ml-14">
            <FormField
              control={form.control}
              name={`questions.${questionIndex}.photoS3Key`}
              render={({ field }) => (
                <FormItem className="mt-5 w-1/3">
                  <Label htmlFor="imageUrl" className="body-base-md">
                    <span className="mr-1 text-red-500">*</span>
                    {t("adminCourseView.curriculum.lesson.field.options")}
                  </Label>
                  <FormControl>
                    <ImageUploadInput
                      field={field}
                      handleImageUpload={handleImageUpload}
                      isUploading={isUploading}
                      imageUrl={displayImageUrl}
                    />
                  </FormControl>
                  {isUploading && <p>{t("common.other.uploadingImage")}</p>}
                  {errors?.questions?.[questionIndex]?.photoS3Key && (
                    <p className="text-sm text-red-500">
                      {errors?.questions?.[questionIndex]?.photoS3Key?.message}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`questions.${questionIndex}.type`}
              render={({ field }) => (
                <FormItem className="mt-4 w-1/3">
                  <Label htmlFor="type" className="body-base-md">
                    <span className="mr-1 text-red-500">*</span>
                    {t("adminCourseView.curriculum.lesson.field.type")}
                  </Label>
                  <FormControl>
                    <Select
                      {...field}
                      onValueChange={(value) => field.onChange(value)}
                      defaultValue={QuestionType.PHOTO_QUESTION_SINGLE_CHOICE}
                      value={field.value || QuestionType.PHOTO_QUESTION_SINGLE_CHOICE}
                    >
                      <SelectTrigger>
                        <SelectValue
                          className="body-base-md text-left"
                          placeholder={t(
                            "adminCourseView.curriculum.lesson.placeholder.singleChoice",
                          )}
                        />
                        <SelectValue
                          className="body-base-md text-left"
                          placeholder={t(
                            "adminCourseView.curriculum.lesson.placeholder.multipleChoice",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value={QuestionType.PHOTO_QUESTION_SINGLE_CHOICE}
                          className="body-base-md text-left"
                        >
                          {t("adminCourseView.curriculum.lesson.placeholder.singleChoice")}
                        </SelectItem>
                        <SelectItem
                          value={QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE}
                          className="body-base-md text-left"
                        >
                          {t("adminCourseView.curriculum.lesson.placeholder.multipleChoice")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="ml-14 mt-4">
            {!isOptionEmpty && (
              <>
                <span className="mr-1 text-red-500">*</span>
                <Label className="body-sm-md">
                  {t("adminCourseView.curriculum.lesson.field.options")}
                </Label>
              </>
            )}
            {watchedOptions && watchedOptions?.length > 0 && (
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
                  const optionError =
                    errors?.questions?.[questionIndex]?.options?.[index]?.optionText?.message;

                  return (
                    <SortableList.Item id={item.sortableId}>
                      <div className="mt-2">
                        <div className="flex items-center space-x-2 rounded-xl border border-neutral-200 p-2 pr-3">
                          {!isStructureLocked && (
                            <SortableList.DragHandle>
                              <Icon name="DragAndDropIcon" className="ml-4 mr-3 cursor-move" />
                            </SortableList.DragHandle>
                          )}
                          <Input
                            name={`questions.${questionIndex}.options.${index}.optionText`}
                            type="text"
                            value={item.optionText}
                            onChange={(e) =>
                              handleOptionChange(index as number, "optionText", e.target.value)
                            }
                            placeholder={`${t("adminCourseView.curriculum.lesson.placeholder.option")} ${index + 1}`}
                            required
                            className="flex-1"
                          />
                          <div className="flex items-center">
                            {questionType === QuestionType.PHOTO_QUESTION_SINGLE_CHOICE ? (
                              <Input
                                type="radio"
                                className="size-4 cursor-pointer"
                                name={`questions.${questionIndex}.options.${index}.isCorrect`}
                                checked={item.isCorrect}
                                onChange={() =>
                                  handleOptionChange(index, "isCorrect", !item.isCorrect)
                                }
                                disabled={isStructureLocked}
                              />
                            ) : (
                              <div className="cursor-pointer">
                                <Checkbox
                                  id="isCorrect"
                                  name={`questions.${questionIndex}.options.${index}.isCorrect`}
                                  className="mb-2 mt-2"
                                  checked={item.isCorrect}
                                  onCheckedChange={() =>
                                    handleOptionChange(index, "isCorrect", !item.isCorrect)
                                  }
                                  disabled={isStructureLocked}
                                />
                              </div>
                            )}

                            <Label
                              onClick={() =>
                                handleOptionChange(index, "isCorrect", !item.isCorrect)
                              }
                              className="body-sm ml-2 cursor-pointer align-middle text-neutral-950"
                            >
                              {t("adminCourseView.curriculum.lesson.other.correct")}
                            </Label>
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
            <p className="ml-14 text-sm text-red-500">
              {errors?.questions?.[questionIndex]?.options?.message}
            </p>
          )}
          {!isStructureLocked && (
            <div className="mb-4 ml-14 mt-4 flex gap-2">
              <Button
                className="bg-primary-700"
                data-testid={`add-options-button-${questionIndex}`}
                type="button"
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

export default PhotoQuestion;
