import { useParams } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";

import { ContentTypes, DeleteContentType } from "../../EditCourse.types";

import { useNewChapterForm } from "./hooks/useNewChapterForm";

import type { Chapter } from "../../EditCourse.types";

type NewChapterProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapter: Chapter | null;
};

const NewChapter = ({ setContentTypeToDisplay, chapter }: NewChapterProps) => {
  const { id: courseId } = useParams<{ id: string }>();
  const { t } = useTranslation();

  if (!courseId) {
    throw new Error("courseId is required");
  }

  const { form, onSubmit, onDelete } = useNewChapterForm({
    courseId: courseId ?? "",
    chapter,
    setContentTypeToDisplay,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const buttonStyles = "bg-transparent text-red-500 border border-red-500 hover:bg-red-100";

  return (
    <div className="flex h-min w-full flex-col gap-y-6 rounded-lg bg-white p-8">
      <hgroup className="flex w-full flex-col-reverse gap-y-1">
        <div className="h5 text-neutral-950">
          {chapter ? (
            <>
              <span className="text-neutral-600">
                {t("adminCourseView.curriculum.other.edit")}:{" "}
              </span>
              <span className="font-bold">{chapter.title}</span>
            </>
          ) : (
            t("adminCourseView.curriculum.other.create")
          )}
        </div>
        <p className="body-base-md text-neutral-950">
          {chapter
            ? `${t("adminCourseView.curriculum.other.chapter")} ${chapter.displayOrder}`
            : t("adminCourseView.curriculum.other.chapter")}
        </p>
      </hgroup>
      <Form {...form}>
        <form className="" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="title" className="body-base-md text-neutral-950">
                  <span className="text-error-600">*</span>{" "}
                  {t("adminCourseView.curriculum.chapter.field.title")}
                </Label>
                <FormControl>
                  <Input id="title" {...field} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-4 flex space-x-4">
            <Button type="submit">{t("common.button.save")}</Button>
            {chapter ? (
              <Button
                aria-label="Delete chapter"
                type="button"
                className={buttonStyles}
                onClick={onClickDelete}
              >
                {t("common.button.delete")}
              </Button>
            ) : (
              <Button
                aria-label="Cancel editing"
                className={buttonStyles}
                onClick={() => setContentTypeToDisplay(ContentTypes.EMPTY)}
              >
                {t("common.button.cancel")}
              </Button>
            )}
          </div>
        </form>
      </Form>
      <DeleteConfirmationModal
        open={isModalOpen}
        onClose={onCloseModal}
        onDelete={onDelete}
        contentType={DeleteContentType.CHAPTER}
      />
    </div>
  );
};

export default NewChapter;
