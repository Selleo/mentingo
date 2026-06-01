import { Link } from "@remix-run/react";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { FormTextField } from "~/components/Form/FormTextField";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Form } from "~/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TooltipProvider } from "~/components/ui/tooltip";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { LiveTrainingFormFields } from "~/modules/LiveTraining/components/LiveTrainingFormFields";

import { LIVE_TRAINING_LESSON_FORM_HANDLES } from "../../../../../../../e2e/data/curriculum/handles";
import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { LIVE_TRAINING_LESSON_FORM_MODES } from "./liveTrainingLessonForm.types";
import { ScheduledLiveTrainingList } from "./ScheduledLiveTrainingList";
import { useLiveTrainingLessonForm } from "./useLiveTrainingLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";

type LiveTrainingLessonFormProps = {
  chapterToEdit: Chapter | null;
  language: SupportedLanguages;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
};

export function LiveTrainingLessonForm({
  chapterToEdit,
  language,
  lessonToEdit,
  setContentTypeToDisplay,
  setSelectedLesson,
}: LiveTrainingLessonFormProps) {
  const { t } = useTranslation();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const {
    currentLanguageHasLiveTraining,
    form,
    formMode,
    isPending,
    isLoadingScheduledLiveTrainings,
    isOnlineDeliveryAvailable,
    liveTrainingFormError,
    liveTrainingFormState,
    onSubmit,
    onSubmitEdit,
    scheduledLiveTrainings,
    selectedLiveTrainingId,
    setSelectedLiveTrainingId,
    updateFormMode,
    updateLiveTrainingFormState,
  } = useLiveTrainingLessonForm({
    chapterToEdit,
    language,
    lessonToEdit,
    setContentTypeToDisplay,
  });
  const isEditMode = Boolean(lessonToEdit);
  const linkedLiveTrainingId = lessonToEdit?.liveTrainingId ?? null;
  const shouldShowAssignmentTabs = !isEditMode || !currentLanguageHasLiveTraining;

  const handleDelete = async () => {
    if (!lessonToEdit || !chapterToEdit) return;

    await deleteLesson({
      chapterId: chapterToEdit.id,
      lessonId: lessonToEdit.id,
    });

    setIsDeleteModalOpen(false);
    setContentTypeToDisplay(ContentTypes.EMPTY);
    setSelectedLesson(null);
  };

  return (
    <Card data-testid={LIVE_TRAINING_LESSON_FORM_HANDLES.ROOT}>
      <CardHeader className="px-8 pb-6 pt-8">
        <Breadcrumb
          lessonLabel={t("adminCourseView.curriculum.lesson.other.liveTraining")}
          setContentTypeToDisplay={setContentTypeToDisplay}
          setSelectedLesson={setSelectedLesson}
        />
        <div className="h5 text-neutral-950">
          {t(
            isEditMode
              ? "adminCourseView.curriculum.lesson.liveTraining.editTitle"
              : "adminCourseView.curriculum.lesson.liveTraining.createTitle",
          )}
        </div>
      </CardHeader>
      <CardContent className="px-8">
        <TooltipProvider delayDuration={0}>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(isEditMode ? onSubmitEdit : onSubmit)}
              className="flex flex-col gap-y-6"
            >
              <FormTextField
                data-testid={LIVE_TRAINING_LESSON_FORM_HANDLES.TITLE_INPUT}
                name="title"
                control={form.control}
                label={t("adminCourseView.curriculum.lesson.liveTraining.lessonTitle")}
                placeholder={t(
                  "adminCourseView.curriculum.lesson.liveTraining.lessonTitlePlaceholder",
                )}
                required
              />

              {isEditMode && currentLanguageHasLiveTraining && (
                <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-neutral-950">
                        {t("adminCourseView.curriculum.lesson.liveTraining.linkedTitle")}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        {t("adminCourseView.curriculum.lesson.liveTraining.linkedDescription")}
                      </p>
                    </div>
                    {linkedLiveTrainingId ? (
                      <Button asChild type="button" variant="outline" className="gap-2">
                        <Link to={`/live-training/${linkedLiveTrainingId}`}>
                          <ExternalLink className="size-4" />
                          {t("adminCourseView.curriculum.lesson.liveTraining.openLiveTraining")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </section>
              )}

              {isEditMode && !currentLanguageHasLiveTraining && (
                <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-neutral-950">
                        {t("adminCourseView.curriculum.lesson.liveTraining.languageMissingTitle")}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        {t(
                          "adminCourseView.curriculum.lesson.liveTraining.languageMissingDescription",
                        )}
                      </p>
                    </div>
                    {linkedLiveTrainingId ? (
                      <Button asChild type="button" variant="outline" className="gap-2">
                        <Link to={`/live-training/${linkedLiveTrainingId}`}>
                          <ExternalLink className="size-4" />
                          {t("adminCourseView.curriculum.lesson.liveTraining.openBaseLiveTraining")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </section>
              )}

              {shouldShowAssignmentTabs && (
                <Tabs
                  value={formMode}
                  onValueChange={(value) => updateFormMode(value as typeof formMode)}
                >
                  <TabsList className="h-auto w-fit bg-neutral-100 p-1">
                    <TabsTrigger value={LIVE_TRAINING_LESSON_FORM_MODES.CREATE_NEW}>
                      {t("adminCourseView.curriculum.lesson.liveTraining.createNewTab")}
                    </TabsTrigger>
                    <TabsTrigger value={LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING}>
                      {t("adminCourseView.curriculum.lesson.liveTraining.linkExistingTab")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value={LIVE_TRAINING_LESSON_FORM_MODES.CREATE_NEW} className="mt-5">
                    <LiveTrainingFormFields
                      formState={liveTrainingFormState}
                      onFormStateChange={updateLiveTrainingFormState}
                      idPrefix="lesson-live-training"
                      portalledDatePicker
                      isOnlineDeliveryAvailable={isOnlineDeliveryAvailable}
                    />
                  </TabsContent>

                  <TabsContent
                    value={LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING}
                    className="mt-5"
                  >
                    <ScheduledLiveTrainingList
                      isLoading={isLoadingScheduledLiveTrainings}
                      liveTrainings={scheduledLiveTrainings}
                      selectedLiveTrainingId={selectedLiveTrainingId}
                      onSelect={setSelectedLiveTrainingId}
                    />
                  </TabsContent>
                </Tabs>
              )}

              {liveTrainingFormError && (
                <p className="text-sm font-medium text-error-600">{liveTrainingFormError}</p>
              )}

              <div className="flex gap-x-3">
                <Button
                  data-testid={LIVE_TRAINING_LESSON_FORM_HANDLES.SAVE_BUTTON}
                  type="submit"
                  disabled={
                    isPending ||
                    (shouldShowAssignmentTabs &&
                      formMode === LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING &&
                      !selectedLiveTrainingId)
                  }
                >
                  {t("common.button.save")}
                </Button>
                <Button
                  data-testid={
                    isEditMode
                      ? LIVE_TRAINING_LESSON_FORM_HANDLES.DELETE_BUTTON
                      : LIVE_TRAINING_LESSON_FORM_HANDLES.CANCEL_BUTTON
                  }
                  type="button"
                  variant="outline"
                  onClick={
                    isEditMode
                      ? () => setIsDeleteModalOpen(true)
                      : () => setContentTypeToDisplay(ContentTypes.EMPTY)
                  }
                  className={
                    isEditMode
                      ? "border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
                      : undefined
                  }
                >
                  {isEditMode ? t("common.button.delete") : t("common.button.cancel")}
                </Button>
              </div>
            </form>
          </Form>
        </TooltipProvider>
      </CardContent>
      <DeleteConfirmationModal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDelete}
        contentType={DeleteContentType.LIVE_TRAINING}
        testIds={{
          dialog: LIVE_TRAINING_LESSON_FORM_HANDLES.DELETE_DIALOG,
          confirmButton: LIVE_TRAINING_LESSON_FORM_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON,
          cancelButton: LIVE_TRAINING_LESSON_FORM_HANDLES.DELETE_DIALOG_CANCEL_BUTTON,
        }}
      />
    </Card>
  );
}
