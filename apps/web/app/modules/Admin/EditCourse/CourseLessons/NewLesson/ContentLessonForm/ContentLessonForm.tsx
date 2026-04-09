import { ENTITY_TYPES } from "@repo/shared";
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
import { useLeaveModal } from "~/context/LeaveModalContext";
import {
  buildRichTextFileUploadHandler,
  RICH_TEXT_ACCEPTED_FILE_TYPES,
} from "~/hooks/buildRichTextFileUploadHandler";
import { useEntityResourceUpload } from "~/hooks/useEntityResourceUpload";
import { useRichTextUploadQueue } from "~/hooks/useRichTextUploadQueue";
import { useTusVideoUpload } from "~/hooks/useTusVideoUpload";
import { useUploadDisplayModeDialog } from "~/hooks/useUploadDisplayModeDialog";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import LeaveConfirmationModal from "~/modules/Admin/components/LeaveConfirmationModal";
import { MissingTranslationsAlert } from "~/modules/Admin/EditCourse/components/MissingTranslationsAlert";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useContentLessonForm } from "./hooks/useContentLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";

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
  const [isValidated, setIsValidated] = useState(false);

  const { form, onSubmit, onDelete } = useContentLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    language,
    contextId,
  });
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isLeaveModalOpen, closeLeaveModal, setIsCurrectFormDirty, setIsLeavingContent } =
    useLeaveModal();

  const { mutate: initializeLessonContext } = useInitializeLessonContext();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { mutateAsync: initVideoUpload } = useInitVideoUpload();
  const { uploadResource } = useEntityResourceUpload();
  const { askForDisplayMode, dialog: uploadDisplayModeDialog } = useUploadDisplayModeDialog();
  const { getSessionForFile, uploadVideo } = useTusVideoUpload();
  const { enqueue, setStatus, setProgress, attachUploadId, remove } = useRichTextUploadQueue();

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const handleFileUpload = buildRichTextFileUploadHandler({
    entityType: ENTITY_TYPES.LESSON,
    getVideoSessionForFile: (file) =>
      getSessionForFile({
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
      }),
    uploadVideo,
    uploadResourceFile: (file) =>
      uploadResource({
        file,
        entityType: ENTITY_TYPES.LESSON,
        entityId: lessonToEdit?.id,
        contextId,
        language,
      }),
    askForDisplayMode,
    onVideoUploadError: () => {
      toast({
        description: t("uploadFile.toast.videoFailed"),
        variant: "destructive",
      });
    },
    fallbackUploadErrorMessage: t("uploadFile.toast.videoFailed"),
    uploadQueue: {
      enqueue,
      setStatus,
      setProgress,
      attachUploadId,
      remove,
    },
  });

  const missingTranslations =
    lessonToEdit && !lessonToEdit.title.trim() && !lessonToEdit.description.trim();

  useEffect(() => {
    if (!lessonToEdit) {
      initializeLessonContext(undefined, {
        onSuccess: ({ contextId }) => setContextId(contextId),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { isDirty } = form.formState;

  useEffect(() => {
    setIsCurrectFormDirty(isDirty);
  }, [isDirty, setIsCurrectFormDirty]);

  const handleValidationSuccess = () => {
    setIsValidated(true);
  };

  const handleValidationError = () => {
    setIsValidated(false);
    closeLeaveModal();
  };

  const onValidateLeave = () => {
    form.handleSubmit(handleValidationSuccess, handleValidationError)();
  };

  const onCloseLeaveModal = () => {
    closeLeaveModal();
    setIsCurrectFormDirty(false);
    setIsLeavingContent(false);
  };

  const onSaveLeaveModal = () => {
    form.handleSubmit(onSubmit)();
    closeLeaveModal();
    setIsLeavingContent(false);
  };

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
                    acceptedFileTypes={RICH_TEXT_ACCEPTED_FILE_TYPES}
                    onUpload={handleFileUpload}
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
      <LeaveConfirmationModal
        open={isLeaveModalOpen || false}
        onClose={onCloseLeaveModal}
        onSave={onSaveLeaveModal}
        onValidate={onValidateLeave}
        isValidated={isValidated}
      />
      {uploadDisplayModeDialog}
    </div>
  );
};

export default ContentLessonForm;
