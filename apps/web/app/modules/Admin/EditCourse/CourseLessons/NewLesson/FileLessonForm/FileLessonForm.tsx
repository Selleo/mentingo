import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as tus from "tus-js-client";

import { useDeleteFile } from "~/api/mutations/admin/useDeleteFile";
import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
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
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { MissingTranslationsAlert } from "~/modules/Admin/EditCourse/compontents/MissingTranslationsAlert";
import { useVideoUploadResumeStore } from "~/modules/common/store/useVideoUploadResumeStore";
import { getFileTypeFromName } from "~/utils/getFileTypeFromName";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useFileLessonForm } from "./hooks/useFileLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";

type FileLessonProps = {
  contentTypeToDisplay: string;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  language: SupportedLanguages;
};

type SourceType = "upload" | "external";

const normalizeTusHeaders = (headers: object): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));

const buildFileFingerprint = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

const FileLessonForm = ({
  contentTypeToDisplay,
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
  language,
}: FileLessonProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [processingUploadId, setProcessingUploadId] = useState<string | null>(null);
  const { form, onSubmit, onDelete } = useFileLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    language,
    processingUploadId,
  });
  const { mutateAsync: initVideoUpload } = useInitVideoUpload();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: deleteFile } = useDeleteFile();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getUploadForFile, saveUpload, clearUpload } = useVideoUploadResumeStore();

  const isExternalUrl = form.watch("isExternal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayFileUrl, setDisplayFileUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDisplayFileUrl(lessonToEdit?.fileS3SignedUrl);
    setProcessingUploadId(null);
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

  const handleVideoTusUpload = useCallback(
    async (file: File) => {
      const fileFingerprint = buildFileFingerprint(file);
      const existingUpload = getUploadForFile(file);

      const session =
        existingUpload ??
        (await initVideoUpload({
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          title: file.name,
          resource: "lesson",
          lessonId: lessonToEdit?.id,
        }));

      const tusHeaders = normalizeTusHeaders(session.tusHeaders);
      const tusFingerprint = `bunny-tus:${session.uploadId}:${fileFingerprint}`;

      saveUpload({
        uploadId: session.uploadId,
        bunnyGuid: session.bunnyGuid,
        fileKey: session.fileKey,
        tusEndpoint: session.tusEndpoint,
        tusHeaders,
        expiresAt: session.expiresAt,
        filename: file.name,
        sizeBytes: file.size,
        lastModified: file.lastModified,
      });

      setProcessingUploadId(session.uploadId);
      form.setValue("fileS3Key", session.fileKey);

      const fileType = getFileTypeFromName(file.name);
      if (fileType) {
        form.setValue("fileType", fileType);
      }

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: session.tusEndpoint,
          headers: tusHeaders,
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          retryDelays: [0, 1000, 3000, 5000, 10000],
          fingerprint: async () => tusFingerprint,
          onError: (error) => {
            clearUpload(session.uploadId);
            reject(error);
          },
          onSuccess: () => {
            clearUpload(session.uploadId);
            resolve();
          },
        });

        upload.findPreviousUploads().then((previousUploads) => {
          if (previousUploads.length > 0) {
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
          upload.start();
        });
      });
    },
    [clearUpload, form, getUploadForFile, initVideoUpload, lessonToEdit?.id, saveUpload],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        if (contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM) {
          await handleVideoTusUpload(file);
          return;
        }

        const result = await uploadFile({
          file,
          resource: "lesson",
          lessonId: lessonToEdit?.id,
        });

        if (result.fileUrl) {
          setDisplayFileUrl(result.fileUrl);
        }

        form.setValue("fileS3Key", result.fileKey);

        const fileType = getFileTypeFromName(file.name);

        if (fileType) {
          form.setValue("fileType", fileType);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        const fallbackMessage =
          contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM
            ? t("uploadFile.toast.videoFailed")
            : error instanceof Error
              ? error.message
              : t("uploadFile.toast.videoFailed");
        toast({
          description: fallbackMessage,
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [contentTypeToDisplay, handleVideoTusUpload, lessonToEdit?.id, uploadFile, form, toast, t],
  );

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
    form.setValue(
      "fileType",
      contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM ? "mp4" : "pptx",
    );
  }, [contentTypeToDisplay, form]);

  const type =
    contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM
      ? t("video").toLowerCase()
      : t("presentation").toLowerCase();

  const missingTranslations = lessonToEdit && !lessonToEdit.title.trim();

  const isVideoProcessing =
    contentTypeToDisplay === ContentTypes.VIDEO_LESSON_FORM &&
    !!form.getValues("fileS3Key") &&
    form.getValues("fileS3Key")?.startsWith("processing-");

  return (
    <div className="flex flex-col gap-y-6 rounded-lg bg-white p-8">
      {missingTranslations && <MissingTranslationsAlert />}
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
                  isProcessing={isVideoProcessing}
                  contentTypeToDisplay={contentTypeToDisplay}
                  url={displayFileUrl}
                  onVideoSelected={() => {
                    toast({
                      description: t("uploadFile.toast.videoProcessingStarted"),
                    });

                    form.setValue("fileS3Key", "processing-video");
                    form.setValue("fileType", "mp4");
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
