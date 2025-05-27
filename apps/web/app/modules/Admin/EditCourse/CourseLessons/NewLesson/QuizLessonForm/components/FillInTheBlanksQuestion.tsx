import * as Accordion from "@radix-ui/react-accordion";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, Node, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { DeleteContentType } from "~/modules/Admin/EditCourse/EditCourse.types";

import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type FillInTheBlankQuestionProps = {
  form: UseFormReturn<QuizLessonFormValues>;
  questionIndex: number;
};

const ButtonNode = Node.create({
  name: "button",
  group: "inline",
  inline: true,
  content: "text*",
  parseHTML() {
    return [
      {
        tag: "button",
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "button",

      {
        type: "button",
        class: "bg-primary-200 text-white px-4 rounded-xl cursor-pointer align-baseline",
      },
      node.textContent,
    ];
  },
});

const FillInTheBlanksQuestion = ({ form, questionIndex }: FillInTheBlankQuestionProps) => {
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
      ButtonNode,
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

    const regex = new RegExp(
      `<button type="button" class="bg-primary-200 text-white px-4 rounded-xl cursor-pointer align-baseline">[\\s\\S]*?\\b${escapedWord}\\b[\\s\\S]*?<\\/button>`,
      "s",
    );

    return regex.test(currentValue as string);
  }

  const handleRemoveWord = (index: number) => {
    const wordToRemove = currentOptions[index]?.optionText;

    const updatedOptions = currentOptions.filter((_, i) => i !== index);
    form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
      shouldDirty: true,
    });

    if (wordToRemove && editor) {
      const currentContent = editor.getHTML();

      const escapedWord = wordToRemove.replace(/[.*+?^=!:${}()|[\]/\\]/g, "\\$&");

      const buttonRegex = new RegExp(
        // TODO: Needs to be fixed
        // eslint-disable-next-line
        `<button[^>]*class="[^"]*bg-primary-200[^"]*"[^>]*>[^<]*${escapedWord}[^<]*<\/button>`,
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

    const buttonHTML = `<button type="button" class="bg-primary-200 text-white px-4 rounded-xl cursor-pointer align-baseline">${word} <span class="text-white cursor-pointer" data-word="${word}" onmousedown="event.preventDefault(); handleDelete(event)">X</span></button>`;

    editor.chain().focus().insertContent(buttonHTML).run();

    const regex = /<button[^>]*class="[^"]*bg-primary-200[^"]*"[^>]*>([^<]+)<\/button>/g;

    const currentValue = form.getValues(`questions.${questionIndex}.description`) as string;

    const buttonValues = currentValue
      ? [...currentValue.matchAll(regex)]
          .map((match) => match[1]?.trim() || "")
          .map((text) => text.replace(/\n/g, "").slice(0, -2))
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
    const currentQuestions = form.getValues("questions") || [];
    const updatedQuestions = currentQuestions.filter((_, index) => index !== questionIndex);
    form.setValue("questions", updatedQuestions, { shouldDirty: true });
  };

  useEffect(() => {
    if (!editor) return;

    editor.on("update", () => {
      const html = editor.getHTML();
      form.setValue(`questions.${questionIndex}.description`, html, { shouldDirty: true });
    });

    return () => {
      editor.off("update");
    };
  }, [editor, form, questionIndex]);

  useEffect(() => {
    if (!editor) return;

    const regex = /<button[^>]*class="[^"]*bg-primary-200[^"]*"[^>]*>([^<]+)<\/button>/g;
    const buttonValues = currentDescription
      ? [...currentDescription.matchAll(regex)]
          .map((match) => match[1]?.trim() || "")
          .map((text) => text.replace(/\n/g, "").slice(0, -2))
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
    if (!editor) return;

    const handleEditorClick = (event: MouseEvent) => {
      const button = (event?.target as HTMLElement).closest("button");

      if (button) {
        button.removeAttribute("contenteditable");
        const buttonHtml = button.outerHTML;
        form.setValue(
          `questions.${questionIndex}.description`,
          form.getValues(`questions.${questionIndex}.description`)?.replace(buttonHtml, ""),
          { shouldDirty: true },
        );

        const optionValue = button.innerText.trim().replace(/\s+/g, " ").slice(0, -2);

        if (optionValue) {
          const updatedOptions = form
            .getValues(`questions.${questionIndex}.options`)
            ?.map((option) =>
              option.optionText === optionValue ? { ...option, isCorrect: false } : option,
            );
          form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
            shouldDirty: true,
          });
        }
        button.remove();

        const currentValue = form.getValues(`questions.${questionIndex}.description`) as string;

        const regex = /<button[^>]*class="[^"]*bg-primary-200[^"]*"[^>]*>([^<]+)<\/button>/g;

        const buttonValues = currentValue
          ? [...currentValue.matchAll(regex)]
              .map((match) => match[1]?.trim() || "")
              .map((text) => text.replace(/\n/g, "").slice(0, -2))
          : [];

        const updatedOptions = form
          .getValues(`questions.${questionIndex}.options`)
          ?.map((option) => {
            return {
              ...option,
              displayOrder: buttonValues.indexOf(option.optionText) + 1,
              isCorrect: buttonValues.includes(option.optionText),
            };
          });

        form.setValue(`questions.${questionIndex}.options`, updatedOptions, {
          shouldDirty: true,
        });
      }
    };

    editor.view.dom.addEventListener("click", handleEditorClick);

    return () => {
      editor.view.dom.removeEventListener("click", handleEditorClick);
    };
  }, [editor, form, questionIndex]);

  useEffect(() => {
    const editorElement = document.querySelector(".ProseMirror") as HTMLElement;
    if (editorElement) {
      editorElement.style.minHeight = "200px";
    }
  }, []);

  return (
    <Accordion.Root key={questionIndex} type="single" collapsible>
      <Accordion.Item value={`item-${questionIndex}`}>
        <div className="rounded-xl border-0 p-3 transition-all duration-300">
          <div className="ml-14">
            <span className="mr-1 text-red-500">*</span>
            <Label className="body-sm-md">
              {t("adminCourseView.curriculum.lesson.field.words")}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              {currentOptions.map((option, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center justify-between space-x-2 rounded-full px-4",
                    option.isCorrect ? "bg-success-100" : "bg-primary-200",
                  )}
                  draggable={!containsButtonWithWord(option.optionText)}
                  onDragStart={(e) => handleDragStart(option.optionText, e)}
                >
                  <Icon name="DragAndDropIcon" />
                  {option.isCorrect && <Icon name="Success" />}
                  <span>{option.optionText}</span>
                  <Button
                    onClick={() => handleRemoveWord(index)}
                    type="button"
                    className="text-color-black rounded-full bg-transparent p-0"
                  >
                    X
                  </Button>
                </div>
              ))}
              <div className="flex items-center">
                {!isAddingWord && (
                  <Button
                    onClick={() => setIsAddingWord(true)}
                    type="button"
                    className="mb-4 mt-4 flex items-center rounded-full bg-blue-700 text-white"
                  >
                    <Icon name="Plus" />
                    {t("adminCourseView.curriculum.lesson.button.addWords")}
                  </Button>
                )}
              </div>
            </div>
            {isAddingWord && (
              <div className="mt-4 flex w-1/3 items-center gap-2">
                <Input
                  data-testid="new-word-input"
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder={t("adminCourseView.curriculum.lesson.placeholder.enterWord")}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddWord}
                  data-testid="add-word"
                  type="button"
                  className="bg-blue-700 text-white"
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
            <>
              {errors?.questions?.[questionIndex] && (
                <p className="text-sm text-red-500">
                  {errors?.questions?.[questionIndex]?.options?.message}
                </p>
              )}
            </>
            <FormField
              control={form.control}
              name={`questions.${questionIndex}.description`}
              render={() => (
                <FormItem className="mt-5">
                  <Label htmlFor="description" className="body-sm-md">
                    <span className="mr-1 text-red-500">*</span>
                    {t("adminCourseView.curriculum.lesson.field.sentence")}
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
            <Button
              type="button"
              className="bg-color-white mb-4 mt-4 border border-neutral-300 text-error-700"
              onClick={() => setIsDeleteModalOpen(true)}
            >
              {t("adminCourseView.curriculum.lesson.button.deleteQuestion")}
            </Button>
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
