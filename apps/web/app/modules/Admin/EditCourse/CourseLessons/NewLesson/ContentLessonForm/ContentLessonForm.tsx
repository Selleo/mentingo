import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  DEFAULT_TUS_CHUNK_SIZE,
} from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as tus from "tus-js-client";

import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { useLessonFileUpload } from "~/api/mutations/admin/useLessonFileUpload";
import { FormTextField } from "~/components/Form/FormTextField";
import { Icon } from "~/components/Icon";
import { LessonEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { MissingTranslationsAlert } from "~/modules/Admin/EditCourse/compontents/MissingTranslationsAlert";
import { useVideoUploadResumeStore } from "~/modules/common/store/useVideoUploadResumeStore";
import { baseUrl } from "~/utils/baseUrl";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useContentLessonForm } from "./hooks/useContentLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";
import type { Editor as TiptapEditor } from "@tiptap/react";
import type { InitVideoUploadResponse } from "~/api/generated-api";

type ContentLessonProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  language: SupportedLanguages;
};

const ContentLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
  language,
}: ContentLessonProps) => {
  const { form, onSubmit, onDelete } = useContentLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    language,
  });
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);

  const { mutateAsync: initVideoUpload } = useInitVideoUpload();
  const { mutateAsync: uploadFile } = useLessonFileUpload();
  const { getUploadForFile, saveUpload, clearUpload } = useVideoUploadResumeStore();

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const normalizeTusHeaders = (headers: object): Record<string, string> =>
    Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));

  const buildFileFingerprint = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

  const handleVideoTusUpload = async (
    file: File,
    session: InitVideoUploadResponse,
    editor?: TiptapEditor | null,
  ) => {
    if (!session.tusEndpoint || !session.tusHeaders || !session.expiresAt) {
      throw new Error("Missing upload configuration");
    }

    const existingUpload = getUploadForFile(file);

    const tusHeaders = normalizeTusHeaders(session.tusHeaders ?? {});
    const tusFingerprint = `${session.provider}-tus:${session.uploadId}:${buildFileFingerprint(
      file,
    )}`;

    if (!existingUpload) {
      saveUpload({
        uploadId: session.uploadId,
        bunnyGuid: session.bunnyGuid,
        fileKey: session.fileKey,
        provider: session.provider,
        tusEndpoint: session.tusEndpoint,
        tusHeaders,
        expiresAt: session.expiresAt,
        filename: file.name,
        sizeBytes: file.size,
        lastModified: file.lastModified,
        resourceId: session.resourceId,
      });
    }

    setIsVideoUploading(true);
    setVideoUploadProgress(0);

    try {
      await new Promise<void>((resolve, reject) => {
        toast({
          description: t("uploadFile.toast.videoUploading"),
          duration: Number.POSITIVE_INFINITY,
          variant: "loading",
        });

        const upload = new tus.Upload(file, {
          endpoint: session.tusEndpoint,
          headers: tusHeaders,
          chunkSize: session.partSize ?? DEFAULT_TUS_CHUNK_SIZE,
          metadata: {
            filename: file.name,
            filetype: file.type,
            uploadId: session.uploadId,
          },
          retryDelays: [0, 1000, 3000, 5000, 10000],
          fingerprint: async () => tusFingerprint,
          removeFingerprintOnSuccess: true,
          onProgress: (bytesUploaded, bytesTotal) => {
            if (bytesTotal === 0) return;
            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
            setVideoUploadProgress(progress);
          },
          onError: (error) => {
            clearUpload(session.uploadId);
            reject(error);
          },
          onSuccess: () => {
            clearUpload(session.uploadId);
            toast({
              description: t("uploadFile.toast.videoUploadedProcessing"),
              duration: Number.POSITIVE_INFINITY,
              variant: "success",
            });
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
    } finally {
      setIsVideoUploading(false);
      setVideoUploadProgress(null);
    }

    if (!session.resourceId) return;

    const resourceUrl = `${baseUrl}/api/lesson/lesson-resource/${session.resourceId}`;

    editor
      ?.chain()
      .insertContent("<br />")
      .setVideoEmbed({
        src: resourceUrl,
        sourceType: session.provider === "s3" ? "external" : "internal",
      })
      .run();
  };

  const handleFileUpload = async (file?: File, editor?: TiptapEditor | null) => {
    if (!file || !lessonToEdit?.id) return;

    const isVideo = ALLOWED_VIDEO_FILE_TYPES.includes(file.type);
    const isPresentation = ALLOWED_PRESENTATION_FILE_TYPES.includes(file.type);
    const isDocument =
      ALLOWED_EXCEL_FILE_TYPES.includes(file.type) ||
      ALLOWED_WORD_FILE_TYPES.includes(file.type) ||
      ALLOWED_PDF_FILE_TYPES.includes(file.type);

    if (isVideo) {
      try {
        const existingUpload = getUploadForFile(file);
        const session: InitVideoUploadResponse = existingUpload
          ? {
              ...existingUpload,
              provider: existingUpload.provider ?? "bunny",
            }
          : await initVideoUpload({
              filename: file.name,
              sizeBytes: file.size,
              mimeType: file.type,
              title: file.name,
              resource: "lesson-content",
              lessonId: lessonToEdit?.id,
            });

        await handleVideoTusUpload(file, session, editor);
      } catch (error) {
        console.error("Error uploading video:", error);
        toast({
          description: t("uploadFile.toast.videoFailed"),
          variant: "destructive",
        });
      }
      return;
    }

    await uploadFile(
      {
        file,
        lessonId: lessonToEdit.id,
        language,
        title: file.name,
        description: file.name,
      },
      {
        onSuccess: (data) => {
          const resourceUrl = `${baseUrl}/api/lesson/lesson-resource/${data.data.resourceId}`;
          const chain = editor?.chain().insertContent("<br />");

          if (isPresentation) {
            chain?.setPresentationEmbed({ src: resourceUrl, sourceType: "internal" }).run();
            return;
          }

          if (isDocument) {
            chain
              ?.setDownloadableFile({
                src: resourceUrl,
                name: file.name,
              })
              .run();
            return;
          }

          chain?.insertContent(`<a href="${resourceUrl}">${resourceUrl}</a>`).run();
        },
      },
    );
  };

  const missingTranslations =
    lessonToEdit && !lessonToEdit.title.trim() && !lessonToEdit.description.trim();

  return (
    <div className="flex flex-col gap-y-6 rounded-lg bg-white p-8">
      {missingTranslations && <MissingTranslationsAlert />}
      <div className="flex flex-col gap-y-1">
        {!lessonToEdit && (
          <Breadcrumb
            lessonLabel={t("adminCoursesView.lessonCard.mappedTypes.content")}
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
                  <LessonEditor
                    id="description"
                    content={field.value}
                    lessonId={lessonToEdit?.id}
                    allowFiles={!!lessonToEdit?.id}
                    acceptedFileTypes={[
                      ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
                      ...ALLOWED_VIDEO_FILE_TYPES,
                      ...ALLOWED_EXCEL_FILE_TYPES,
                      ...ALLOWED_PDF_FILE_TYPES,
                      ...ALLOWED_WORD_FILE_TYPES,
                      ...ALLOWED_PRESENTATION_FILE_TYPES,
                    ]}
                    onUpload={handleFileUpload}
                    uploadProgress={isVideoUploading ? (videoUploadProgress ?? 0) : null}
                    onCtrlSave={() => form.handleSubmit(onSubmit)()}
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
        contentType={DeleteContentType.CONTENT}
      />
    </div>
  );
};

export default ContentLessonForm;
