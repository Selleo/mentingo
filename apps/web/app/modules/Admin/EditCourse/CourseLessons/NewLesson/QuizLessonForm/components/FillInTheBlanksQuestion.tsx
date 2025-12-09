import * as Accordion from "@radix-ui/react-accordion";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { DeleteContentType } from "~/modules/Admin/EditCourse/EditCourse.types";

import { QuestionType } from "../QuizLessonForm.types";

import { FillInTheBlanksButtonNode } from "./FillInTheBlanksButtonNode";

import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type FillInTheBlankQuestionProps = {
  form: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
  questionType: QuestionType;
  isStructureLocked?: boolean;
};

const FillInTheBlanksQuestion = ({
  form,
  questionIndex,
  questionType,
  isStructureLocked = false,
}: FillInTheBlankQuestionProps) => {
  const [newWord, setNewWord] = useState("");
  const [isAddingWord, setIsAddingWord] = useState(false);
  const currentOptions = form.getValues(`questions.${questionIndex}.options`) || [];
  const currentDescription = form.getValues(`questions.${questionIndex}.description`);

  const errors = form.formState.errors;
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Color,
      TextStyle,
      FillInTheBlanksButtonNode,
      Highlight.configure({ multicolor: true }),
    ],
    content: form.getValues(`questions.${questionIndex}.description`) || "",
  });

  const onDeleteQuestion = () => {
    handleRemoveQuestion();
    setIsDeleteModalOpen(false);
  };

  const handleDragStart = (word: string, e: React.DragEvent) => {
    e.dataTransfer.setData("text", word);
  };

  function containsButtonWithWord(word: string) {
    const currentValue = form.getValues(`questions.${questionIndex}.description`);

    const escapedWord = word.replace(/[.*+?^=!:${}()|[\]/\\]/g, "\\$&");

    const regex = new RegExp(`<button[^>]*data-word="${escapedWord}"[^>]*>`, "s");

    return regex.test(currentValue as string);
  }

  const handleRemoveWord = (index: number) => {
    if (isStructureLocked) return;

    const wordToRemove = currentOptions[index]?.optionText;

    const updatedOptions = currentOptions.filter((_, i) => i !== index);
    form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
      shouldDirty: true,
    });

    if (wordToRemove && editor) {
      const currentContent = editor.getHTML();

      const escapedWord = wordToRemove.replace(/[.*+?^=!:${}()|[\]/\\]/g, "\\$&");

      const buttonRegex = new RegExp(
        `<button[^>]*data-word="${escapedWord}"[^>]*>[\\s\\S]*?<\\/button>`,
        "gi",
      );

      const updatedContent = currentContent.replace(buttonRegex, "");

      editor.commands.setContent(updatedContent);

      form.setValue(`questions.${questionIndex}.description`, updatedContent, {
        shouldDirty: true,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const word = e.dataTransfer.getData("text");
    if (!word || !editor) return;

    if (containsButtonWithWord(word)) return;

    editor
      .chain()
      .focus()
      .insertContent({
        type: "button",
        attrs: { word },
      })
      .run();

    const regex = /<button[^>]*data-word="([^"]*)"[^>]*>/g;

    const currentValue = form.getValues(`questions.${questionIndex}.description`) as string;

    const buttonValues = currentValue
      ? [...currentValue.matchAll(regex)].map((match) => match[1] || "")
      : [];

    const updatedOptions = [...currentOptions];

    buttonValues.forEach((button: string, index: number) => {
      const optionIndex = updatedOptions.findIndex((option) => option.optionText === button);

      if (optionIndex !== -1) {
        updatedOptions[optionIndex] = {
          ...updatedOptions[optionIndex],
          displayOrder: index + 1,
          isCorrect: true,
        };
      }
    });

    form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
      shouldDirty: true,
    });
  };
  const handleAddWord = () => {
    if (isStructureLocked) return;

    const trimmedWord = newWord.trim();

    if (trimmedWord !== "" && !currentOptions.some((option) => option.optionText === trimmedWord)) {
      const newOption = {
        sortableId: crypto.randomUUID(),
        optionText: trimmedWord,
        isCorrect: false,
        displayOrder: currentOptions.length + 1,
      };

      form.setValue(`questions.${questionIndex}.options`, [...currentOptions, newOption], {
        shouldDirty: true,
      });

      setNewWord("");
      setIsAddingWord(false);
    } else {
      setIsAddingWord(false);
    }
  };

  const handleRemoveQuestion = () => {
    if (isStructureLocked) return;

    const currentQuestions = form.getValues("questions") || [];
    const updatedQuestions = currentQuestions.filter((_, index) => index !== questionIndex);
    form.setValue("questions", updatedQuestions, { shouldDirty: true });
  };

  useEffect(() => {
    if (!editor) return;

    editor.on("update", () => {
      const html = editor.getHTML();
      form.setValue(`questions.${questionIndex}.description`, html, {
        shouldDirty: true,
      });

      const regex = /<button[^>]*data-word="([^"]*)"[^>]*>/g;
      const buttonValues = html ? [...html.matchAll(regex)].map((match) => match[1] || "") : [];

      const updatedOptions = form.getValues(`questions.${questionIndex}.options`)?.map((option) => {
        return {
          ...option,
          displayOrder: buttonValues.indexOf(option.optionText) + 1,
          isCorrect: buttonValues.includes(option.optionText),
        };
      });

      form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
        shouldDirty: true,
      });
    });

    return () => {
      editor.off("update");
    };
  }, [editor, form, questionIndex]);

  useEffect(() => {
    if (!editor) return;

    const regex = /<button[^>]*data-word="([^"]*)"[^>]*>/g;
    const buttonValues = currentDescription
      ? [...currentDescription.matchAll(regex)].map((match) => match[1] || "")
      : [];

    const updatedOptions = form.getValues(`questions.${questionIndex}.options`)?.map((option) => {
      return {
        ...option,
        isCorrect: buttonValues.includes(option.optionText),
      };
    });

    form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
      shouldDirty: true,
    });
  }, [currentDescription, form, questionIndex, editor]);

  useEffect(() => {
    const editorElement = document.querySelector(".ProseMirror") as HTMLElement;
    if (editorElement) {
      editorElement.style.minHeight = "200px";
    }
  }, []);

  const descriptionKey = useMemo(() => {
    return questionType === QuestionType.FILL_IN_THE_BLANKS_DND
      ? "adminCourseView.curriculum.lesson.other.fillInTheBlanksDescription"
      : "adminCourseView.curriculum.lesson.other.gapFillDescription";
  }, [questionType]);

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const handleUpdateWord = (index: number, value: string) => {
    const options = [...currentOptions];
    const previousWord = options[index]?.optionText ?? "";
    options[index] = {
      ...options[index],
      optionText: value,
    };
    form.setValue(`questions.${questionIndex}.options`, options, { shouldDirty: true });

    const description = form.getValues(`questions.${questionIndex}.description`) as string;
    if (!description || !previousWord || !editor) return;

    const wordPattern = escapeRegExp(previousWord);
    const updatedDescription = description.replace(
      new RegExp(
        `<button([^>]*?)data-word="${wordPattern}"([^>]*)><span>[^<]*<\\/span>(<span[^>]*>[\\s\\S]*?<\\/span>)?<\\/button>`,
        "g",
      ),
      `<button$1data-word="${value}"$2><span>${value}</span>$3</button>`,
    );

    editor.commands.setContent(updatedDescription);
    form.setValue(`questions.${questionIndex}.description`, updatedDescription, {
      shouldDirty: true,
    });
  };

  return (
    <Accordion.Root key={questionIndex} type="single" collapsible>
      <Accordion.Item value={`item-${questionIndex}`}>
        <div className="rounded-xl border-0 px-3 pb-3 transition-all duration-300">
          <div className="ml-14">
            <p className="body-sm-md pb-4 text-neutral-700">{t(descriptionKey)}</p>
            <FormField
              control={form.control}
              name={`questions.${questionIndex}.description`}
              render={() => (
                <FormItem>
                  <Label htmlFor="description" className="body-sm-md">
                    <span className="mr-1 text-red-500">*</span>
                    {t("adminCourseView.curriculum.lesson.field.sentence")}
                    <p className="body-sm-md pb-1 text-neutral-700">
                      {t("adminCourseView.curriculum.lesson.other.fillInTheBlanksSentenceTip")}
                    </p>
                  </Label>
                  <FormControl>
                    <EditorContent
                      editor={editor}
                      className="h-full min-h-[200px] w-full overflow-y-auto rounded-lg border border-gray-300 bg-white p-4 text-black focus:border-none focus:outline-none focus:ring-0"
                      onDrop={handleDrop}
                      onClick={() => editor?.commands.focus()}
                    />
                  </FormControl>
                  {errors?.questions?.[questionIndex]?.description && (
                    <p className="text-sm text-red-500">
                      {errors?.questions?.[questionIndex]?.description?.message}
                    </p>
                  )}
                </FormItem>
              )}
            />
            <div className="mb-1.5 mt-5">
              <span className="mr-1 text-red-500">*</span>
              <Label className="body-sm-md">
                {t("adminCourseView.curriculum.lesson.field.words")}
                <p className="body-sm-md pb-1 text-neutral-700">
                  {t("adminCourseView.curriculum.lesson.other.fillInTheBlanksWordTip")}
                </p>
              </Label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentOptions.map((option, index) => {
                const isDraggable = !containsButtonWithWord(option.optionText);

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between gap-x-1 rounded-lg border border-primary-500 pr-3",
                      option.isCorrect ? "bg-success-100" : "bg-primary-100",
                    )}
                  >
                    <div className="flex items-center">
                      <button
                        type="button"
                        className="pl-1.5 pr-1"
                        draggable={isDraggable}
                        onDragStart={(e) => handleDragStart(option.optionText, e)}
                        aria-label={t("adminCourseView.curriculum.lesson.other.dragWord")}
                      >
                        <Icon name="DragAndDropIcon" className="cursor-move" />
                      </button>
                      {option.isCorrect && <Icon name="Success" />}
                      <Input
                        value={option.optionText}
                        draggable={false}
                        onChange={(e) => handleUpdateWord(index, e.target.value)}
                        className="mr-1.5 w-auto min-w-[80px] border-none bg-transparent px-0 text-primary-500 focus-visible:ring-0 focus-visible:outline-none"
                        onDrop={(event) => event.preventDefault()}
                      />
                    </div>
                    {!isStructureLocked && (
                      <Button
                        onClick={() => handleRemoveWord(index)}
                        type="button"
                        className="rounded-full bg-transparent p-0 text-primary-500"
                      >
                        <Icon name="X" className="size-2.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
              {!isStructureLocked && (
                <div className="flex items-center">
                  {!isAddingWord && (
                    <Button
                      onClick={() => setIsAddingWord(true)}
                      type="button"
                      className="mb-4 mt-4 flex items-center gap-2"
                    >
                      <Icon name="Plus" />
                      {t("adminCourseView.curriculum.lesson.button.addWords")}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isAddingWord && !isStructureLocked && (
              <div
                className={cn(
                  "flex items-center gap-2",
                  currentOptions.length === 0 ? "mt-0" : "mt-2",
                )}
              >
                <Input
                  data-testid="new-word-input"
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder={t("adminCourseView.curriculum.lesson.placeholder.enterWord")}
                  className="grow"
                  disabled={isStructureLocked}
                />
                <Button onClick={handleAddWord} data-testid="add-word" type="button">
                  {t("common.button.add")}
                </Button>
                <Button
                  onClick={() => setIsAddingWord(false)}
                  type="button"
                  className="bg-color-transparent border border-neutral-200 bg-red-500 text-white"
                >
                  {t("common.button.cancel")}
                </Button>
              </div>
            )}
            {errors?.questions?.[questionIndex] && (
              <p className="mt-1.5 text-sm text-red-500">
                {errors?.questions?.[questionIndex]?.options?.message}
              </p>
            )}
            {!isStructureLocked && (
              <Button
                type="button"
                className="bg-color-white mb-4 mt-4 border border-neutral-300 text-error-700"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                {t("adminCourseView.curriculum.lesson.button.deleteQuestion")}
              </Button>
            )}
          </div>
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

export default FillInTheBlanksQuestion;
