import { isArray } from "lodash-es";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FormTextField } from "~/components/Form/FormTextField";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Form } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { EmbedLessonResourceCard } from "./components/EmbedLessonResourceCard";
import { DEFAULT_EMBED_LESSON_RESOURCE, MAX_EMBED_LESSON_RESOURCES } from "./constants";
import { useEmbedLessonForm } from "./hooks/useEmbedLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";

type EmbedLessonProps = {
  lessonToEdit?: Lesson | null;
  chapterToEdit: Chapter | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
};

export const EmbedLessonForm = ({
  lessonToEdit,
  chapterToEdit,
  setContentTypeToDisplay,
  setSelectedLesson,
}: EmbedLessonProps) => {
  const { t } = useTranslation();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { form, onSubmit, onDelete } = useEmbedLessonForm({
    lessonToEdit,
    chapterToEdit,
    setContentTypeToDisplay,
  });

  const resources = form.watch("resources");

  console.log("resources", resources);

  const hasReachedMaxResources = useMemo(() => {
    return isArray(resources) && resources.length >= MAX_EMBED_LESSON_RESOURCES;
  }, [resources]);

  const handleAddNewResource = () => {
    if (hasReachedMaxResources) return;

    const existingResources = form.getValues("resources") || [];

    form.setValue("resources", [...existingResources, DEFAULT_EMBED_LESSON_RESOURCE], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleDeleteLesson = () =>
    lessonToEdit ? setIsModalOpen(true) : () => setContentTypeToDisplay(ContentTypes.EMPTY);

  const onCloseDeleteModal = () => setIsModalOpen(false);

  return (
    <Card>
      <CardHeader className="px-8 pb-6 pt-8">
        {!lessonToEdit && (
          <Breadcrumb
            lessonLabel={t("adminCourseView.curriculum.lesson.other.embed")}
            setContentTypeToDisplay={setContentTypeToDisplay}
            setSelectedLesson={setSelectedLesson}
          />
        )}
        <div className="h5 text-neutral-950">
          {lessonToEdit ? (
            <>
              <span className="text-neutral-600">
                {t("adminCourseView.curriculum.other.edit")}
                {": "}
              </span>
              <span className="font-bold">{lessonToEdit.title}</span>
            </>
          ) : (
            t("adminCourseView.curriculum.other.create")
          )}
        </div>
      </CardHeader>
      <CardContent className="px-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-y-5">
            <FormTextField
              name="title"
              control={form.control}
              label={t("adminCourseView.curriculum.lesson.field.title")}
              placeholder={t("adminCourseView.curriculum.lesson.placeholder.title")}
              required
            />
            <div className="space-y-3">
              <Label>{t("adminCourseView.curriculum.other.resources")}</Label>
              {resources?.map((_, resourceIndex) => {
                const hasError = !!form.formState.errors.resources?.[resourceIndex];

                return (
                  <EmbedLessonResourceCard
                    key={resourceIndex}
                    form={form}
                    hasError={hasError}
                    resourceIndex={resourceIndex}
                  />
                );
              })}
            </div>
            <div className="flex gap-x-3">
              <Button type="submit">{t("common.button.save")}</Button>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={hasReachedMaxResources}
                onClick={handleAddNewResource}
              >
                {t("adminCourseView.curriculum.lesson.button.addResource")}
              </Button>
              <Button
                type="button"
                onClick={handleDeleteLesson}
                className="border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
              >
                {lessonToEdit ? t("common.button.delete") : t("common.button.cancel")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <DeleteConfirmationModal
        open={isModalOpen}
        onClose={onCloseDeleteModal}
        onDelete={onDelete}
        contentType={DeleteContentType.EMBED}
      />
    </Card>
  );
};
