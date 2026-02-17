import { useParams } from "@remix-run/react";
import { AI_MENTOR_TYPE, ALLOWED_EXTENSIONS } from "@repo/shared";
import { capitalize } from "lodash-es";
import { Camera, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadAiMentorAvatar } from "~/api/mutations/admin/useUploadAiMentorAvatar";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { FormTextField } from "~/components/Form/FormTextField";
import { Icon } from "~/components/Icon";
import { BaseEditor } from "~/components/RichText/Editor";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TooltipArrow,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { MissingTranslationsAlert } from "~/modules/Admin/EditCourse/compontents/MissingTranslationsAlert";
import { MultiFileUploadForm } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/components/MultiFileUploadForm";
import AiMentorLessonPreview from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/hooks/AiMentorLessonPreview";
import { SuggestionExamples } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/utils/AiMentor.constants";

import { DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import { useAiMentorLessonForm } from "./hooks/useAiMentorLessonForm";
import UpdateAiAvatarModal from "./UpdateAiAvatarModal";

import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";

type AiMentorLessonProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  language: SupportedLanguages;
};

const AiMentorLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
  language,
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
    language,
  });

  const { t } = useTranslation();

  const { id = "" } = useParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { mutateAsync: uploadAvatar } = useUploadAiMentorAvatar();

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    lessonToEdit?.avatarReferenceUrl ?? null,
  );
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setAvatarPreview(lessonToEdit?.avatarReferenceUrl ?? null);
    setSelectedAvatarFile(null);
    setRemoveAvatar(false);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, [lessonToEdit]);

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const onOpenPreview = () => setPreviewOpen(true);
  const onClosePreview = () => setPreviewOpen(false);
  const onOpenAvatarDialog = () => {
    setIsAvatarDialogOpen(true);
  };

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleAvatarSave = async ({ file, remove }: { file: File | null; remove: boolean }) => {
    if (!lessonToEdit?.id) return;

    await uploadAvatar({ lessonId: lessonToEdit.id, file });

    await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id }] });

    if (remove) {
      revokeObjectUrl();
      setAvatarPreview(null);
      setSelectedAvatarFile(null);
      setRemoveAvatar(true);
      return;
    }

    if (file) {
      revokeObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setAvatarPreview(objectUrl);
      setSelectedAvatarFile(file);
      setRemoveAvatar(false);
      return;
    }
  };

  const handleRemoveAvatar = () => {
    revokeObjectUrl();
    setAvatarPreview(null);
    setSelectedAvatarFile(null);
    setRemoveAvatar(true);
  };

  const handleAvatarDialogCancel = () => {
    setIsAvatarDialogOpen(false);
  };

  return (
    <>
      {lessonToEdit && previewOpen && (
        <AiMentorLessonPreview lesson={lessonToEdit} onClose={onClosePreview} />
      )}
      <TooltipProvider delayDuration={0}>
        <div className="relative flex flex-col gap-y-6 rounded-lg bg-white p-8">
          {lessonToEdit && !lessonToEdit.title.trim() && <MissingTranslationsAlert />}
          <div className="flex flex-col gap-y-1">
            {!lessonToEdit && (
              <Breadcrumb
                lessonLabel={t("common.lessonTypes.ai_mentor")}
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
            <form
              onSubmit={form.handleSubmit((data) =>
                onSubmit(data, removeAvatar ? null : (selectedAvatarFile ?? undefined)),
              )}
              className="flex grow flex-col"
            >
              <div className="flex lg:items-center flex-col-reverse lg:flex-row lg:gap-4 gap-2">
                <div className="flex flex-col flex-1">
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
                </div>

                <Separator orientation="vertical" className="lg:h-14" />

                <div className="flex gap-2">
                  <div className="relative size-12">
                    <Avatar
                      className={cn(
                        "size-12 group overflow-hidden border-2 border-border transition",
                        {
                          "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1":
                            lessonToEdit,
                          "border-dotted border-neutral-300": !avatarPreview && lessonToEdit,
                        },
                      )}
                      onClick={() => lessonToEdit && onOpenAvatarDialog()}
                    >
                      <AvatarImage src={avatarPreview ?? undefined} />

                      <AvatarFallback>
                        <Icon name="AiMentor" className="size-8 text-primary" />
                      </AvatarFallback>
                      {lessonToEdit && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-neutral-950 bg-opacity-70 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {t("common.button.edit")}
                        </div>
                      )}
                    </Avatar>
                    {lessonToEdit &&
                      (avatarPreview ? (
                        <button
                          type="button"
                          className="size-4 absolute -left-0 -bottom-0 flex items-center justify-center rounded-full bg-primary text-contrast hover:opacity-80 shadow-md"
                          onClick={handleRemoveAvatar}
                        >
                          <Minus className="size-4" />
                        </button>
                      ) : (
                        <div className="size-4 absolute -left-0 -bottom-0 flex items-center justify-center rounded-full bg-neutral-100 shadow-md text-neutral-800 hover:opacity-80">
                          <Camera className="size-3" />
                        </div>
                      ))}
                  </div>

                  <div className="flex flex-1 lg:flex-0 flex-col gap-1">
                    <FormField
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <Label className="text-muted-foreground text-sm">
                              {t("adminCourseView.curriculum.lesson.field.mentorName")}
                            </Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Icon
                                    name="Info"
                                    className="h-auto w-5 cursor-default text-neutral-400"
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="center"
                                className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                              >
                                {t(
                                  "adminCourseView.curriculum.lesson.other.aiMentorPersonaTooltip",
                                )}
                                <TooltipArrow className="fill-black" />
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          <input
                            type="text"
                            className="outline-0 text-sm bg-transparent border-b"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormItem>
                      )}
                      name="name"
                    />
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => {
                  return (
                    <FormItem className="mb-4">
                      <Label htmlFor="description" className="flex items-center gap-2">
                        <span>{t("adminCourseView.curriculum.lesson.field.taskDescription")}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Icon name="Info" className="size-6 text-neutral-800" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            className="max-w-sm whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                          >
                            {t("adminCourseView.curriculum.lesson.other.taskDescriptionTooltip")}
                            <TooltipArrow className="fill-black" />
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <FormControl>
                        <Textarea
                          {...field}
                          id="description"
                          className="placeholder:body-base h-[164px] resize-none placeholder:text-neutral-600"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                render={({ field }) => (
                  <FormItem className="mb-4 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="categoryId">
                        <span className="text-red-500">*</span>{" "}
                        {t("adminCourseView.curriculum.lesson.field.aiMentorTypes")}
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
                          <ul className="flex flex-col gap-2 list-disc list-inside">
                            {Object.entries({
                              Mentor: "adminCourseView.curriculum.lesson.other.aiMentorTypeTooltip",
                              Teacher:
                                "adminCourseView.curriculum.lesson.other.aiTeacherTypeTooltip",
                              Roleplay:
                                "adminCourseView.curriculum.lesson.other.aiRoleplayTypeTooltip",
                            }).map(([label, translationKey]) => (
                              <li key={label} className="text-sm">
                                <span className="font-semibold">{label}:</span> {t(translationKey)}
                              </li>
                            ))}
                          </ul>

                          <TooltipArrow className="fill-black" />
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(AI_MENTOR_TYPE).map((item, index) => (
                          <SelectItem value={item} key={`${item}-${index}`}>
                            {capitalize(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
                control={form.control}
                name="type"
              ></FormField>

              <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-2">
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
                          <BaseEditor
                            content={field.value}
                            placeholder={t(
                              "adminCourseView.curriculum.lesson.placeholder.aiMentorInstructions",
                            )}
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
                          <BaseEditor
                            content={field.value}
                            placeholder={t(
                              "adminCourseView.curriculum.lesson.placeholder.completionConditions",
                            )}
                            parentClassName="lg:rounded-l-none"
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
              {lessonToEdit && (
                <div className="mb-6">
                  <MultiFileUploadForm lessonId={lessonToEdit.id} />
                </div>
              )}

              <div className="flex justify-between">
                <div className="flex gap-x-4">
                  <Button type="submit">{t("common.button.save")}</Button>
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
                {lessonToEdit && (
                  <Button type="button" onClick={onOpenPreview} variant="primary">
                    {t("adminCourseView.common.testAiMentor")}
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
          <UpdateAiAvatarModal
            open={isAvatarDialogOpen}
            onOpenChange={(open) => {
              if (open) {
                onOpenAvatarDialog();
              } else {
                handleAvatarDialogCancel();
              }
            }}
            onCancel={handleAvatarDialogCancel}
            onSave={(data) => {
              handleAvatarSave(data);
              setIsAvatarDialogOpen(false);
            }}
            currentPreview={avatarPreview}
            accept={ALLOWED_EXTENSIONS}
          />
        </div>
      </TooltipProvider>
    </>
  );
};

export default AiMentorLessonForm;
