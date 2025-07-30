import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteFile } from "~/api/mutations/admin/useDeleteFile";
import { useUploadFile } from "~/api/mutations/admin/useUploadFile";
import FileUploadInput from "~/components/FileUploadInput/FileUploadInput";
import { FormTextareaField } from "~/components/Form/FormTextareaFiled";
import { FormTextField } from "~/components/Form/FormTextField";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { getFileTypeFromName } from "~/utils/getFileTypeFromName";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useFileLessonForm } from "./hooks/useFileLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";

type FileLessonProps = {
  contentTypeToDisplay: string;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
};

type SourceType = "upload" | "external";

const FileLessonForm = ({
  contentTypeToDisplay,
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
}: FileLessonProps) => {
  const { form, onSubmit, onDelete } = useFileLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
  });
  const [isUploading, setIsUploading] = useState(false);
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: deleteFile } = useDeleteFile();
  const fileType = form.watch("fileType");
  const { t } = useTranslation();

  const isExternalUrl = form.watch("isExternal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayFileUrl, setDisplayFileUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDisplayFileUrl(lessonToEdit?.fileS3SignedUrl);
    form.reset({
      ...lessonToEdit,
      type:
        lessonToEdit?.type === "presentation" || lessonToEdit?.type === "video"
          ? lessonToEdit.type
          : undefined,
    });
  }, [lessonToEdit, form]);

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);

      try {
        const result = await uploadFile({ file, resource: "lesson" });
        setDisplayFileUrl(result.fileUrl);
        form.setValue("fileS3Key", result.fileKey);
        const fileType = getFileTypeFromName(file.name);

        if (fileType) {
          form.setValue("fileType", fileType);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFile, form],
  );

  const handleFileDelete = useCallback(() => {
    const fileKey = form.getValues("fileS3Key");

    if (fileKey) {
      deleteFile(fileKey)
        .then(() => {
          setDisplayFileUrl("");
          form.setValue("fileS3Key", "");
          form.setValue("fileType", "");
        })
        .catch((error) => {
          console.error("Error deleting file:", error);
        });
    }
  }, [deleteFile, form]);

  const handleSourceTypeChange = (value: SourceType) => {
    const isExternalUrlValue = value === "external";
    form.setValue("isExternal", isExternalUrlValue);
    form.setValue("fileS3Key", "");
    setDisplayFileUrl("");
  };

  useEffect(() => {
    form.setValue(
      "type",
      contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM ? "video" : "presentation",
    );
    form.setValue("fileType", fileType);
  }, [contentTypeToDisplay, form, fileType]);

  const type =
    contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM
      ? t("video").toLowerCase()
      : t("presentation").toLowerCase();

  return (
    <div className="flex flex-col gap-y-6 rounded-lg bg-white p-8">
      <div className="flex flex-col gap-y-1">
        <Breadcrumb
          lessonLabel={
            contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM
              ? t("adminCourseView.curriculum.lesson.other.video")
              : t("adminCourseView.curriculum.lesson.other.presentation")
          }
          setContentTypeToDisplay={setContentTypeToDisplay}
          setSelectedLesson={setSelectedLesson}
        />
        <div className="h5 text-neutral-950">
          {lessonToEdit ? (
            <>
              <span className="text-neutral-600">
                {t("adminCourseView.curriculum.other.edit")}:
              </span>{" "}
              {lessonToEdit?.title}
            </>
          ) : (
            t("common.button.create")
          )}
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-y-6">
          <FormTextField
            control={form.control}
            name="title"
            label={t("adminCourseView.curriculum.lesson.field.title")}
            placeholder={t("adminCourseView.curriculum.lesson.placeholder.title")}
            required
          />
          <FormField
            control={form.control}
            name="isExternal"
            render={() => (
              // TODO: add translation keys
              <FormItem>
                <Label className="body-base-md text-neutral-950">
                  {t("adminCourseView.curriculum.lesson.field.sourceType")}
                </Label>
                <Select
                  value={isExternalUrl ? "external" : "upload"}
                  onValueChange={(value: SourceType) => handleSourceTypeChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">
                      {t("adminCourseView.settings.selectButton.uploadFile")}
                    </SelectItem>
                    <SelectItem value="external">
                      {t("adminCourseView.settings.selectButton.External")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {isExternalUrl ? (
            <FormTextField
              control={form.control}
              name="fileS3Key"
              label={t("adminCourseView.settings.selectButton.External")}
              placeholder={t("adminCourseView.curriculum.lesson.placeholder.enterURL")}
              required
            />
          ) : (
            <FormItem>
              <Label htmlFor="file" className="body-base-md text-neutral-950">
                <span className="text-error-600">*</span>{" "}
                {contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM
                  ? t("adminCourseView.curriculum.lesson.field.video")
                  : t("adminCourseView.curriculum.lesson.field.presentation")}
              </Label>
              <FormControl>
                <FileUploadInput
                  handleFileUpload={handleFileUpload}
                  handleFileDelete={handleFileDelete}
                  isUploading={isUploading}
                  contentTypeToDisplay={contentTypeToDisplay}
                  url={displayFileUrl}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
          <FormTextareaField
            label={t("adminCourseView.settings.field.description")}
            name="description"
            control={form.control}
            placeholder={t("adminCourseView.curriculum.lesson.placeholder.fileDescription", {
              type,
            })}
          />
          <div className="flex gap-x-3">
            <Button type="submit" className="bg-primary-700 text-white hover:bg-blue-600">
              {t("common.button.save")}
            </Button>
            <Button
              type="button"
              onClick={
                lessonToEdit ? onClickDelete : () => setContentTypeToDisplay(ContentTypes.EMPTY)
              }
              className="border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
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
        contentType={
          ContentTypes.VIDEO_LESSON_FORM ? DeleteContentType.VIDEO : DeleteContentType.PRESENTATION
        }
      />
    </div>
  );
};

export default FileLessonForm;
