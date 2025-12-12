import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";


import { ApiClient } from "~/api/api-client";
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
import { useToast } from "~/components/ui/use-toast";
import { addPendingUpload, removePendingUpload } from "~/hooks/useGlobalVideoUploadPolling";
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
  const [isUploading, setIsUploading] = useState(false);
  const [processingUploadId, setProcessingUploadId] = useState<string | null>(null);
  const { form, onSubmit, onDelete } = useFileLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    processingUploadId,
  });
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: deleteFile } = useDeleteFile();
  const { t } = useTranslation();
  const { toast } = useToast();

  const isExternalUrl = form.watch("isExternal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayFileUrl, setDisplayFileUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDisplayFileUrl(lessonToEdit?.fileS3SignedUrl);
    setProcessingUploadId(null); // Reset processing state when switching lessons
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
      try {
        const result = await uploadFile({
          file,
          resource: "lesson",
          lessonId: lessonToEdit?.id
        });

        if (result.fileUrl) {
          setDisplayFileUrl(result.fileUrl);
        }

        form.setValue("fileS3Key", result.fileKey);
        if (result?.status === "processing" && result.uploadId) {
          // Add to global polling instead of local
          addPendingUpload(result.uploadId);
          setProcessingUploadId(result.uploadId); // Keep for backward compatibility
        }

        const fileType = getFileTypeFromName(file.name);

        if (fileType) {
          form.setValue("fileType", fileType);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        setIsUploading(false); // Reset uploading state on error
      }
    },
    [uploadFile, form],
  );

  useEffect(() => {
    if (!processingUploadId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await ApiClient.instance.get("/api/file/status", {
          params: { uploadId: processingUploadId },
        });
        const data = response.data;

        if (data?.status === "processed") {
          if (data?.fileKey) {
            form.setValue("fileS3Key", data.fileKey);
          }
          if (data?.fileUrl) {
            setDisplayFileUrl(data.fileUrl);
          }

          // Remove from global polling and show toast
          removePendingUpload(processingUploadId);
          toast({
            description: t("uploadFile.toast.videoReady", {
              defaultValue: "Video is ready to use.",
            }),
          });

          setProcessingUploadId(null);
        }
      } catch (error) {
        console.error("Error checking video status:", error);
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      // Remove from global polling when component unmounts
      if (processingUploadId) {
        removePendingUpload(processingUploadId);
      }
    };
  }, [processingUploadId, form, toast, t]);

  const handleFileDelete = useCallback(async () => {
    const fileKey = form.getValues("fileS3Key");

    try {
      if (fileKey) {
        await deleteFile(fileKey);

        setDisplayFileUrl("");
        form.setValue("fileS3Key", "");
        form.setValue("fileType", "");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
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
    form.setValue("fileType", contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM ? "mp4" : "pptx");
  }, [contentTypeToDisplay, form]);

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
              <span className="break-words">{lessonToEdit?.title}</span>
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
                  onVideoSelected={() => {
                    // Show processing toast immediately when video is selected
                    toast({
                      description: t("uploadFile.toast.videoProcessingStarted", {
                        defaultValue: "Video upload started. We'll notify you once it's processed.",
                      }),
                    });
                    // Set placeholder fileS3Key immediately to allow saving lesson
                    form.setValue("fileS3Key", "processing-video");
                    form.setValue("fileType", "mp4"); // Default video type
                  }}
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
            <Button type="submit">{t("common.button.save")}</Button>
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
