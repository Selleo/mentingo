import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FormTextField } from "~/components/Form/FormTextField";
import { Icon } from "~/components/Icon";
import Editor from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TooltipArrow,
} from "~/components/ui/tooltip";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { SuggestionExamples } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/utils/AiMentor.constants";

import { DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useAiMentorLessonForm } from "./hooks/useAiMentorLessonForm";

import type { Chapter, Lesson } from "../../../EditCourse.types";

type AiMentorLessonProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
};

const AiMentorLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
}: AiMentorLessonProps) => {
  const {
    form,
    onSubmit,
    onDelete,
    handleSuggestionClick,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    onConfirmOverwrite,
    onCancelOverwrite,
  } = useAiMentorLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
  });

  const { t } = useTranslation();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col gap-y-6 rounded-lg bg-white p-8">
        <div className="flex flex-col gap-y-1">
          {!lessonToEdit && (
            <Breadcrumb
              lessonLabel="AI Mentor"
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
                <span className="font-bold">{lessonToEdit.title}</span>
              </>
            ) : (
              t("common.button.create")
            )}
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex grow flex-col">
            <div className="flex items-center">
              <span className="mr-1 text-red-500">*</span>
              <Label htmlFor="title" className="mr-2">
                {t("adminCourseView.curriculum.lesson.field.title")}
              </Label>
            </div>
            <FormTextField
              control={form.control}
              name="title"
              id="title"
              placeholder={t("adminCourseView.curriculum.lesson.placeholder.title")}
              className="mb-4"
            />
            <div className="mb-4 grid grid-cols-1 lg:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="aiMentorInstructions" className="mb-2 block">
                      <span className="mr-1 text-red-500">*</span>
                      {t("adminCourseView.curriculum.lesson.field.aiMentorInstructions")}
                    </Label>
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
                        className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                      >
                        {t("adminCourseView.curriculum.lesson.other.aiMentorInstructionsTooltip")}
                        <TooltipArrow className="fill-black" />
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="aiMentorInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Editor
                          content={field.value}
                          placeholder={t(
                            "adminCourseView.curriculum.lesson.placeholder.aiMentorInstructions",
                          )}
                          className="h-48 grow resize-none overflow-y-auto"
                          parentClassName="lg:rounded-r-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <div className="mt-4 flex items-center justify-between lg:mt-0">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="completionConditions" className="mb-2 block">
                      <span className="mr-1 text-red-500">*</span>
                      {t("adminCourseView.curriculum.lesson.field.completionConditions")}
                    </Label>
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
                        className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                      >
                        {t("adminCourseView.curriculum.lesson.other.completionConditionsTooltip")}
                        <TooltipArrow className="fill-black" />
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="completionConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Editor
                          content={field.value}
                          placeholder={t(
                            "adminCourseView.curriculum.lesson.placeholder.completionConditions",
                          )}
                          className="h-48 grow resize-none overflow-y-auto"
                          parentClassName={"lg:rounded-l-none lg:border-l-0"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="mb-6 rounded-lg bg-neutral-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                {t("adminCourseView.curriculum.lesson.other.suggestedExamples")}
              </h3>
              <div className="grid min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SuggestionExamples.map(({ onClick, translationKey }) => (
                  <Button
                    key={onClick}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="box-border min-w-0 justify-center px-4 text-center"
                    onClick={() => handleSuggestionClick(onClick)}
                  >
                    <span className="block w-full truncate">{t(translationKey)}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-x-4">
              <Button type="submit" className="bg-primary-700">
                {t("common.button.save")}
              </Button>
              {lessonToEdit && (
                <Button
                  type="button"
                  onClick={onClickDelete}
                  className="bg-color-white border border-neutral-300 text-error-700"
                >
                  {t("common.button.delete")}
                </Button>
              )}
            </div>
          </form>
        </Form>
        <DeleteConfirmationModal
          open={isModalOpen}
          onClose={onCloseModal}
          onDelete={onDelete}
          contentType={DeleteContentType.AI_MENTOR}
        />
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("adminCourseView.curriculum.lesson.other.overwriteContent")}
              </DialogTitle>
              <DialogDescription>
                {t("adminCourseView.curriculum.lesson.other.overwriteContentDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onCancelOverwrite}>
                {t("common.button.cancel")}
              </Button>
              <Button onClick={onConfirmOverwrite} className="bg-primary-700">
                {t("clientStatisticsView.button.continue")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default AiMentorLessonForm;
