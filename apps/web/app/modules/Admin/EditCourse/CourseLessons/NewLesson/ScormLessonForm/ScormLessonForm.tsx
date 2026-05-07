import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useAttachScormLessonPackage } from "~/api/mutations/admin/useAttachScormLessonPackage";
import { useCreateScormLesson } from "~/api/mutations/admin/useCreateScormLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateContentLesson } from "~/api/mutations/admin/useUpdateContentLesson";
import { FormTextField } from "~/components/Form/FormTextField";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useLeaveModal } from "~/context/LeaveModalContext";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { ScormPackageUploadField } from "~/modules/Admin/Scorm/components/ScormPackageUploadField";
import { isBrowserFile } from "~/utils/isBrowserFile";

import { SCORM_LESSON_FORM_HANDLES } from "../../../../../../../e2e/data/curriculum/handles";
import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { scormLessonFormSchema } from "./validators/scormLessonFormSchema";

import type { ScormLessonFormValues } from "./validators/scormLessonFormSchema";
import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";

type ScormLessonFormProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  language: SupportedLanguages;
};

export const ScormLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
  language,
}: ScormLessonFormProps) => {
  const { t } = useTranslation();
  const { mutateAsync: createScormLesson, isPending: isCreatingScormLesson } =
    useCreateScormLesson();
  const { mutateAsync: attachScormLessonPackage, isPending: isAttachingScormLessonPackage } =
    useAttachScormLessonPackage();
  const { mutateAsync: updateScormLesson, isPending: isUpdatingScormLesson } =
    useUpdateContentLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { setIsCurrectFormDirty } = useLeaveModal();
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const currentLanguageHasPackage = Boolean(
    lessonToEdit?.scormPackageLanguages?.includes(language),
  );

  const form = useForm<ScormLessonFormValues>({
    resolver: zodResolver(scormLessonFormSchema(t, Boolean(lessonToEdit))),
    mode: "onChange",
    defaultValues: {
      title: lessonToEdit?.title ?? "",
      scormFile: undefined,
    },
  });

  const { isDirty } = form.formState;

  useEffect(() => {
    setIsCurrectFormDirty(isDirty);
  }, [isDirty, setIsCurrectFormDirty]);

  const onSubmit = async (values: ScormLessonFormValues) => {
    if (lessonToEdit) {
      await updateScormLesson({
        lessonId: lessonToEdit.id,
        data: {
          title: values.title,
          description: lessonToEdit.description ?? "",
          type: lessonToEdit.type,
          language,
        },
      });

      if (isBrowserFile(values.scormFile)) {
        await attachScormLessonPackage({
          lessonId: lessonToEdit.id,
          data: {
            title: values.title,
            language,
            scormPackage: values.scormFile,
          },
        });
      }

      setIsCurrectFormDirty(false);
      setContentTypeToDisplay(ContentTypes.EMPTY);
      return;
    }

    if (!chapterToEdit || !isBrowserFile(values.scormFile)) return;

    await createScormLesson({
      data: {
        chapterId: chapterToEdit.id,
        title: values.title,
        language,
        scormPackage: values.scormFile,
      },
    });

    setIsCurrectFormDirty(false);
    setContentTypeToDisplay(ContentTypes.EMPTY);
  };

  const handleClear = () => {
    setSelectedFile(undefined);
    form.setValue("scormFile", undefined, { shouldDirty: true, shouldValidate: true });
  };

  const handleDelete = async () => {
    if (!lessonToEdit || !chapterToEdit) return;

    await deleteLesson({
      chapterId: chapterToEdit.id,
      lessonId: lessonToEdit.id,
    });

    setIsDeleteModalOpen(false);
    setIsCurrectFormDirty(false);
    setContentTypeToDisplay(ContentTypes.EMPTY);
    setSelectedLesson(null);
  };

  return (
    <div
      data-testid={SCORM_LESSON_FORM_HANDLES.ROOT}
      className="flex w-full flex-col gap-y-8 rounded-lg bg-white p-8"
    >
      <Breadcrumb
        lessonLabel={t("common.lessonTypes.scorm")}
        setContentTypeToDisplay={setContentTypeToDisplay}
        setSelectedLesson={setSelectedLesson}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormTextField
            control={form.control}
            name="title"
            label={t("adminCourseView.curriculum.lesson.field.title")}
            placeholder={t("adminCourseView.settings.placeholder.title")}
            data-testid={SCORM_LESSON_FORM_HANDLES.TITLE_INPUT}
            required
          />

          <FormField
            control={form.control}
            name="scormFile"
            render={({ field, fieldState }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <Label className="body-base-md">
                    {!lessonToEdit ? <span className="text-red-500">*</span> : null}{" "}
                    {t("adminScorm.lesson.packageSection")}
                  </Label>
                  {lessonToEdit ? (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            data-testid={SCORM_LESSON_FORM_HANDLES.PACKAGE_INFO_TOOLTIP_TRIGGER}
                          >
                            <Icon
                              name="Info"
                              className="h-auto w-6 cursor-default text-neutral-800"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="center"
                          className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                        >
                          {t("adminScorm.lesson.languagePackageTooltip")}
                          <TooltipArrow className="fill-black" />
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                </div>
                <FormControl>
                  {currentLanguageHasPackage ? (
                    <ScormPackageUploadField
                      disabled
                      readonlyDescription={t("adminScorm.lesson.packageAttached")}
                      testIds={{
                        root: SCORM_LESSON_FORM_HANDLES.PACKAGE_UPLOAD,
                        input: SCORM_LESSON_FORM_HANDLES.PACKAGE_INPUT,
                        readonly: SCORM_LESSON_FORM_HANDLES.PACKAGE_READONLY,
                      }}
                      onChange={() => undefined}
                      onClear={() => undefined}
                    />
                  ) : (
                    <ScormPackageUploadField
                      file={selectedFile}
                      error={fieldState.error?.message}
                      importNotice={t("adminScorm.lesson.importNotice")}
                      testIds={{
                        root: SCORM_LESSON_FORM_HANDLES.PACKAGE_UPLOAD,
                        input: SCORM_LESSON_FORM_HANDLES.PACKAGE_INPUT,
                        selectedFile: SCORM_LESSON_FORM_HANDLES.PACKAGE_SELECTED_FILE,
                        replaceButton: SCORM_LESSON_FORM_HANDLES.PACKAGE_REPLACE_BUTTON,
                        removeButton: SCORM_LESSON_FORM_HANDLES.PACKAGE_REMOVE_BUTTON,
                      }}
                      onChange={(file) => {
                        setSelectedFile(file);
                        field.onChange(file);
                      }}
                      onClear={handleClear}
                    />
                  )}
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex gap-3">
            <Button
              type="submit"
              data-testid={SCORM_LESSON_FORM_HANDLES.SAVE_BUTTON}
              disabled={
                !form.formState.isValid ||
                isCreatingScormLesson ||
                isUpdatingScormLesson ||
                isAttachingScormLessonPackage
              }
            >
              {t("common.button.save")}
            </Button>
            <Button
              type="button"
              data-testid={
                lessonToEdit
                  ? SCORM_LESSON_FORM_HANDLES.DELETE_BUTTON
                  : SCORM_LESSON_FORM_HANDLES.CANCEL_BUTTON
              }
              variant="outline"
              onClick={
                lessonToEdit
                  ? () => setIsDeleteModalOpen(true)
                  : () => setContentTypeToDisplay(ContentTypes.EMPTY)
              }
              className={
                lessonToEdit
                  ? "border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
                  : undefined
              }
            >
              {lessonToEdit ? t("common.button.delete") : t("common.button.cancel")}
            </Button>
          </div>
        </form>
      </Form>
      <DeleteConfirmationModal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDelete}
        contentType={DeleteContentType.SCORM}
        testIds={{
          dialog: SCORM_LESSON_FORM_HANDLES.DELETE_DIALOG,
          confirmButton: SCORM_LESSON_FORM_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON,
          cancelButton: SCORM_LESSON_FORM_HANDLES.DELETE_DIALOG_CANCEL_BUTTON,
        }}
      />
    </div>
  );
};
