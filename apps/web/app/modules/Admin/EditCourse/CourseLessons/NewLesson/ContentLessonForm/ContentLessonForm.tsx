import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  ENTITY_TYPES,
} from "@repo/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInitializeLessonContext } from "~/api/mutations/admin/useInitializeLessonContext";
import { useInitVideoUpload } from "~/api/mutations/admin/useInitVideoUpload";
import { FormTextField } from "~/components/Form/FormTextField";
import { Icon } from "~/components/Icon";
import { ContentEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import {
  buildEntityResourceUrl,
  insertResourceIntoEditor,
  useEntityResourceUpload,
} from "~/hooks/useEntityResourceUpload";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { MissingTranslationsAlert } from "~/modules/Admin/EditCourse/compontents/MissingTranslationsAlert";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useContentLessonForm } from "./hooks/useContentLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";
import type { Editor as TiptapEditor } from "@tiptap/react";

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
  const [contextId, setContextId] = useState<string | undefined>(undefined);

  const { form, onSubmit, onDelete } = useContentLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    language,
    contextId,
  });
  const { t } = useTranslation();
  const { toast } = useToast();

  const { mutate: initializeLessonContext } = useInitializeLessonContext();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { mutateAsync: initVideoUpload } = useInitVideoUpload();
  const { uploadResource } = useEntityResourceUpload();
  const { getSessionForFile, uploadVideo, isUploading, uploadProgress } = useTusVideoUpload();

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const handleFileUpload = async (file?: File, editor?: TiptapEditor | null) => {
    if (!file) return;

    const isVideo = ALLOWED_VIDEO_FILE_TYPES.includes(file.type);
    const isPresentation = ALLOWED_PRESENTATION_FILE_TYPES.includes(file.type);
    const isDocument =
      ALLOWED_EXCEL_FILE_TYPES.includes(file.type) ||
      ALLOWED_WORD_FILE_TYPES.includes(file.type) ||
      ALLOWED_PDF_FILE_TYPES.includes(file.type);

    if (isVideo) {
      try {
        const session = await getSessionForFile({
          file,
          init: () =>
            initVideoUpload({
              filename: file.name,
              sizeBytes: file.size,
              mimeType: file.type,
              title: file.name,
              resource: "lesson-content",
              contextId,
              entityId: lessonToEdit?.id,
              entityType: ENTITY_TYPES.LESSON,
            }),
        });

        await uploadVideo({ file, session });

        if (session.resourceId) {
          const resourceUrl = buildEntityResourceUrl(session.resourceId, ENTITY_TYPES.LESSON);

          editor
            ?.chain()
            .insertContent("<br />")
            .setVideoEmbed({
              src: resourceUrl,
              sourceType: session.provider === "s3" ? "external" : "internal",
            })
            .run();
        }
      } catch (error) {
        console.error("Error uploading video:", error);
        toast({
          description: t("uploadFile.toast.videoFailed"),
          variant: "destructive",
        });
      }
      return;
    }

    const resourceId = await uploadResource({
      file,
      entityType: ENTITY_TYPES.LESSON,
      entityId: lessonToEdit?.id,
      contextId,
      language,
    });

    insertResourceIntoEditor({
      editor,
      resourceId,
      entityType: ENTITY_TYPES.LESSON,
      file,
      isPresentation,
      isDocument,
    });
  };

  const missingTranslations =
    lessonToEdit && !lessonToEdit.title.trim() && !lessonToEdit.description.trim();

  useEffect(() => {
    if (!lessonToEdit) {
      initializeLessonContext(undefined, {
        onSuccess: ({ contextId }) => setContextId(contextId),
      });
    }
  }, []);

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
                  <ContentEditor
                    id="description"
                    content={field.value}
                    lessonId={lessonToEdit?.id}
                    allowFiles={!!lessonToEdit?.id || !!contextId}
                    acceptedFileTypes={[
                      ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
                      ...ALLOWED_VIDEO_FILE_TYPES,
                      ...ALLOWED_EXCEL_FILE_TYPES,
                      ...ALLOWED_PDF_FILE_TYPES,
                      ...ALLOWED_WORD_FILE_TYPES,
                      ...ALLOWED_PRESENTATION_FILE_TYPES,
                    ]}
                    onUpload={handleFileUpload}
                    uploadProgress={isUploading ? (uploadProgress ?? 0) : null}
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
