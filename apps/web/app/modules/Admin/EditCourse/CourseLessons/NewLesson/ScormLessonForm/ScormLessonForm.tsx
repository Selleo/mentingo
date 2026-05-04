import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

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
  const { mutateAsync: updateScormLesson, isPending: isUpdatingScormLesson } =
    useUpdateContentLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { setIsCurrectFormDirty } = useLeaveModal();
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

      setIsCurrectFormDirty(false);
      setContentTypeToDisplay(ContentTypes.EMPTY);
      return;
    }

    if (!chapterToEdit || !isBrowserFile(values.scormFile)) return;

    await createScormLesson({
      data: {
        chapterId: chapterToEdit.id,
        title: values.title,
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
    <div className="flex w-full flex-col gap-y-8 rounded-lg bg-white p-8">
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
                          <span>
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
                          {t("adminScorm.lesson.replacePackageTooltip")}
                          <TooltipArrow className="fill-black" />
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                </div>
                <FormControl>
                  {lessonToEdit ? (
                    <ScormPackageUploadField
                      disabled
                      readonlyDescription={t("adminScorm.lesson.packageLocked")}
                      onChange={() => undefined}
                      onClear={() => undefined}
                    />
                  ) : (
                    <ScormPackageUploadField
                      file={selectedFile}
                      error={fieldState.error?.message}
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
              disabled={!form.formState.isValid || isCreatingScormLesson || isUpdatingScormLesson}
            >
              {t("common.button.save")}
            </Button>
            <Button
              type="button"
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
      />
    </div>
  );
};
