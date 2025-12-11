import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FormTextField } from "~/components/Form/FormTextField";
import { Icon } from "~/components/Icon";
import Editor from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { MissingTranslationsAlert } from "~/modules/Admin/EditCourse/compontents/MissingTranslationsAlert";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useTextLessonForm } from "./hooks/useTextLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";

type TextLessonProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  language: SupportedLanguages;
};

const TextLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
  language,
}: TextLessonProps) => {
  const { form, onSubmit, onDelete } = useTextLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    language,
  });
  const { t } = useTranslation();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const missingTranslations =
    lessonToEdit && !lessonToEdit.title.trim() && !lessonToEdit.description.trim();

  return (
    <div className="flex flex-col gap-y-6 rounded-lg bg-white p-8">
      {missingTranslations && <MissingTranslationsAlert />}
      <div className="flex flex-col gap-y-1">
        {!lessonToEdit && (
          <Breadcrumb
            lessonLabel="Text"
            setContentTypeToDisplay={setContentTypeToDisplay}
            setSelectedLesson={setSelectedLesson}
          />
        )}
        <div className="h5 text-neutral-950">
          {lessonToEdit ? (
            <>
              <span className="text-neutral-600">
                {t("adminCourseView.curriculum.other.edit")}:{" "}
              </span>
              <span className="font-bold break-words">{lessonToEdit.title}</span>
            </>
          ) : (
            t("common.button.create")
          )}
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex items-center">
            <span className="mr-1 text-red-500">*</span>
            <Label htmlFor="title" className="mr-2">
              {t("adminCourseView.curriculum.lesson.field.title")}
            </Label>
          </div>
          <FormTextField
            control={form.control}
            name="title"
            placeholder={t("adminCourseView.curriculum.lesson.placeholder.title")}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="description" className="body-base-md mt-6 text-neutral-950">
                  <span className="text-red-500">*</span>{" "}
                  {t("adminCourseView.curriculum.lesson.field.description")}
                </Label>
                <FormControl>
                  <Editor
                    id="description"
                    content={field.value}
                    lessonId={lessonToEdit?.id}
                    allowFiles={!!lessonToEdit?.id}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.formState.errors.description && (
            <p className="details-md flex items-center gap-x-1.5 text-error-600">
              <Icon name="Warning" />
              {form.formState.errors.description.message}
            </p>
          )}
          <div className="flex gap-x-3">
            <Button type="submit" className="mt-6">
              {t("adminCourseView.curriculum.lesson.button.saveLesson")}
            </Button>
            <Button
              type="button"
              onClick={
                lessonToEdit ? onClickDelete : () => setContentTypeToDisplay(ContentTypes.EMPTY)
              }
              className="mt-6 border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
            >
              {lessonToEdit ? t("common.button.delete") : t("common.button.cancel")}
            </Button>
          </div>
        </form>
      </Form>
      <DeleteConfirmationModal
        open={isModalOpen}
        onClose={onCloseModal}
        onDelete={onDelete}
        contentType={DeleteContentType.TEXT}
      />
    </div>
  );
};

export default TextLessonForm;
