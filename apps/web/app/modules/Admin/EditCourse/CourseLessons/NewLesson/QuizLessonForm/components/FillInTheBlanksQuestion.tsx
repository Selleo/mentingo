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

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { QuestionType } from "../QuizLessonForm.types";

import { FillInTheBlanksButtonNode } from "./FillInTheBlanksButtonNode";

import type { QuestionOption } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type FillInTheBlankQuestionProps = {
  form: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
  questionType: QuestionType;
  isStructureLocked?: boolean;
};

const SPECIAL_SYMBOLS = /[.*+?^${}()|[\]\\]/g;
const FILL_BLANK_BUTTON_REGEX = /<button\b[^>]*>[\s\S]*?<\/button>/g;

type FillBlankButtonData = {
  optionId?: string;
  word: string;
};

type DraggedWordData = FillBlankButtonData;

const getHtmlAttribute = (html: string, attribute: string) =>
  new RegExp(`${attribute}="([^"]*)"`).exec(html)?.[1] ?? "";

const getOptionId = (option: QuestionOption) => option.id ?? option.sortableId;

const parseFillBlankButtons = (html?: string | null): FillBlankButtonData[] => {
  const buttons = html?.match(FILL_BLANK_BUTTON_REGEX) ?? [];

  return buttons.map((button) => ({
    optionId: getHtmlAttribute(button, "data-option-id") || undefined,
    word: getHtmlAttribute(button, "data-word"),
  }));
};

const parseDraggedWord = (event: React.DragEvent): DraggedWordData | null => {
  const jsonPayload = event.dataTransfer.getData("application/json");
  if (jsonPayload) {
    try {
      const data = JSON.parse(jsonPayload) as DraggedWordData;
      if (data.word) return data;
    } catch {
      // Fall back to the text payload for synthetic or legacy drag events.
    }
  }

  const word = event.dataTransfer.getData("text");
  return word ? { word } : null;
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

  const handleDragStart = (option: QuestionOption, e: React.DragEvent) => {
    const payload: DraggedWordData = {
      optionId: getOptionId(option),
      word: option.optionText,
    };

    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.setData("text", option.optionText);
  };

  function containsButtonForOption(option: QuestionOption) {
    const currentValue = form.getValues(`questions.${questionIndex}.description`) as
      | string
      | undefined;
    const optionId = getOptionId(option);
    const buttons = parseFillBlankButtons(currentValue);

    return buttons.some((button) => {
      if (button.optionId) return button.optionId === optionId;

      return button.word === option.optionText;
    });
  }

  const handleRemoveWord = (index: number) => {
    if (isStructureLocked) return;

    const optionToRemove = currentOptions[index];

    const updatedOptions = currentOptions.filter((_, i) => i !== index);
    form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
      shouldDirty: true,
    });

    if (optionToRemove && editor) {
      const currentContent = editor.getHTML();
      const optionId = getOptionId(optionToRemove);
      const updatedContent = currentContent.replace(FILL_BLANK_BUTTON_REGEX, (button) => {
        const buttonOptionId = getHtmlAttribute(button, "data-option-id");
        const buttonWord = getHtmlAttribute(button, "data-word");

        if (buttonOptionId) return buttonOptionId === optionId ? "" : button;

        return buttonWord === optionToRemove.optionText ? "" : button;
      });

      editor.commands.setContent(updatedContent);

      form.setValue(`questions.${questionIndex}.description`, updatedContent, {
        shouldDirty: true,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const draggedWord = parseDraggedWord(e);
    if (!draggedWord || !editor) return;

    const placedOptionIds = new Set(
      parseFillBlankButtons(form.getValues(`questions.${questionIndex}.description`) as string)
        .map(({ optionId }) => optionId)
        .filter((optionId): optionId is string => Boolean(optionId)),
    );
    const optionToPlace =
      currentOptions.find((option) => getOptionId(option) === draggedWord.optionId) ??
      currentOptions.find(
        (option) =>
          option.optionText === draggedWord.word && !placedOptionIds.has(getOptionId(option)),
      );

    if (!optionToPlace || containsButtonForOption(optionToPlace)) return;

    editor
      .chain()
      .focus()
      .insertContent({
        type: "button",
        attrs: { word: optionToPlace.optionText, optionId: getOptionId(optionToPlace) },
      })
      .run();
  };
  const handleAddWord = () => {
    if (isStructureLocked) return;

    const trimmedWord = newWord.trim();

    if (trimmedWord !== "") {
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

    const updateOptionsFromEditor = () => {
      const html = editor.getHTML();
      form.setValue(`questions.${questionIndex}.description`, html, {
        shouldDirty: true,
      });

      const buttons = parseFillBlankButtons(html);
      const usedLegacyButtonIndexes = new Set<number>();

      const updatedOptions = form.getValues(`questions.${questionIndex}.options`)?.map((option) => {
        const optionId = getOptionId(option);
        let buttonIndex = buttons.findIndex((button) => button.optionId === optionId);

        if (buttonIndex === -1) {
          buttonIndex = buttons.findIndex((button, index) => {
            if (button.optionId || usedLegacyButtonIndexes.has(index)) return false;

            return button.word === option.optionText;
          });
        }

        if (buttonIndex !== -1) {
          usedLegacyButtonIndexes.add(buttonIndex);
        }

        return {
          ...option,
          displayOrder: buttonIndex + 1,
          isCorrect: buttonIndex !== -1,
        };
      });

      form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
        shouldDirty: true,
      });
    };

    editor.on("update", updateOptionsFromEditor);

    return () => {
      editor.off("update", updateOptionsFromEditor);
    };
  }, [editor, form, questionIndex]);

  useEffect(() => {
    if (!editor) return;

    const buttons = parseFillBlankButtons(currentDescription);
    const usedLegacyButtonIndexes = new Set<number>();

    const updatedOptions = form.getValues(`questions.${questionIndex}.options`)?.map((option) => {
      const optionId = getOptionId(option);
      let buttonIndex = buttons.findIndex((button) => button.optionId === optionId);

      if (buttonIndex === -1) {
        buttonIndex = buttons.findIndex((button, index) => {
          if (button.optionId || usedLegacyButtonIndexes.has(index)) return false;

          return button.word === option.optionText;
        });
      }

      if (buttonIndex !== -1) {
        usedLegacyButtonIndexes.add(buttonIndex);
      }

      return {
        ...option,
        isCorrect: buttonIndex !== -1,
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

  const escapeRegExp = (value: string) => value.replace(SPECIAL_SYMBOLS, "\\$&");

  const handleUpdateWord = (index: number, value: string) => {
    const options = [...currentOptions];
    const option = options[index];
    const previousWord = options[index]?.optionText ?? "";
    options[index] = {
      ...options[index],
      optionText: value,
    };
    form.setValue(`questions.${questionIndex}.options`, options, { shouldDirty: true });

    const description = form.getValues(`questions.${questionIndex}.description`) as string;
    if (!description || !previousWord || !editor) return;

    const optionId = option ? getOptionId(option) : "";
    const wordPattern = escapeRegExp(previousWord);
    const updatedDescription = description.replace(FILL_BLANK_BUTTON_REGEX, (button) => {
      const buttonOptionId = getHtmlAttribute(button, "data-option-id");
      const buttonWord = getHtmlAttribute(button, "data-word");

      if (buttonOptionId && buttonOptionId !== optionId) return button;
      if (!buttonOptionId && buttonWord !== previousWord) return button;

      return button.replace(
        new RegExp(
          `data-word="${wordPattern}"([^>]*)><span>[^<]*<\\/span>(<span[^>]*>[\\s\\S]*?<\\/span>)?`,
        ),
        `data-word="${value}"$1><span>${value}</span>$2`,
      );
    });

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
                      data-testid={QUIZ_LESSON_FORM_HANDLES.fillBlanksEditor(questionIndex)}
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
                const isDraggable = !containsButtonForOption(option);
                const optionId = getOptionId(option);

                return (
                  <div
                    key={optionId}
                    className={cn(
                      "flex items-center justify-between gap-x-1 rounded-lg border border-primary-500 pr-3",
                      option.isCorrect ? "bg-success-100" : "bg-primary-100",
                    )}
                  >
                    <div className="flex items-center">
                      <button
                        type="button"
                        data-testid={QUIZ_LESSON_FORM_HANDLES.dragWordButton(
                          questionIndex,
                          option.optionText,
                        )}
                        data-option-id={optionId}
                        className="pl-1.5 pr-1"
                        draggable={isDraggable}
                        onDragStart={(event) => handleDragStart(option, event)}
                        aria-label={t("adminCourseView.curriculum.lesson.other.dragWord")}
                      >
                        <Icon name="DragAndDropIcon" className="cursor-move" />
                      </button>
                      {option.isCorrect && <Icon name="Success" />}
                      <Input
                        value={option.optionText}
                        draggable={isDraggable}
                        onDragStart={(event) => handleDragStart(option, event)}
                        onChange={(event) => handleUpdateWord(index, event.target.value)}
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
                      data-testid={QUIZ_LESSON_FORM_HANDLES.addWordButton(questionIndex)}
                      onClick={() => setIsAddingWord(true)}
                      type="button"
                      className="my-4 flex items-center gap-2"
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
                  data-testid={QUIZ_LESSON_FORM_HANDLES.newWordInput(questionIndex)}
                  type="text"
                  value={newWord}
                  onChange={(event) => setNewWord(event.target.value)}
                  placeholder={t("adminCourseView.curriculum.lesson.placeholder.enterWord")}
                  className="grow"
                  disabled={isStructureLocked}
                />
                <Button
                  onClick={handleAddWord}
                  data-testid={QUIZ_LESSON_FORM_HANDLES.saveWordButton(questionIndex)}
                  type="button"
                >
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
                data-testid={QUIZ_LESSON_FORM_HANDLES.questionDeleteButton(questionIndex)}
                type="button"
                className="bg-color-white my-4 border border-neutral-300 text-error-700"
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
