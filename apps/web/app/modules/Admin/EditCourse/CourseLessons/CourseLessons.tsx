import { useParams, useSearchParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useLeaveModal } from "~/context/LeaveModalContext";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { UnsavedChangesExitGuard } from "~/modules/Admin/components/UnsavedChangesExitGuard";
import { CourseGenerationDrawer } from "~/modules/CourseAuthoring/CourseGenerationDrawer";
import { CurriculumReviewWorkspace } from "~/modules/CourseAuthoring/review/CurriculumReviewWorkspace";
import { syncReviewPreview } from "~/modules/CourseAuthoring/review/syncReviewPreview";

import { CURRICULUM_HANDLES } from "../../../../../e2e/data/curriculum/handles";
import { ContentTypes } from "../EditCourse.types";

import ChaptersList from "./components/ChaptersList";
import CourseLessonEmptyState from "./components/CourseLessonEmptyState";
import NewChapter from "./NewChapter/NewChapter";
import AiMentorLessonForm from "./NewLesson/AiMentorLessonForm/AiMentorLessonForm";
import SelectLessonType from "./NewLesson/components/SelectLessonType";
import ContentLessonForm from "./NewLesson/ContentLessonForm/ContentLessonForm";
import { EmbedLessonForm } from "./NewLesson/EmbedLessonForm/EmbedLessonForm";
import { LiveTrainingLessonForm } from "./NewLesson/LiveTrainingLessonForm/LiveTrainingLessonForm";
import QuizLessonForm from "./NewLesson/QuizLessonForm/QuizLessonForm";
import { ScormLessonForm } from "./NewLesson/ScormLessonForm/ScormLessonForm";

import type { Chapter, Lesson } from "../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";
import type { Sortable } from "~/components/SortableList/SortableList";
import type {
  CurriculumPreview,
  CurriculumPreviewActions,
  PreviewView,
} from "~/modules/CourseAuthoring/courseAuthoring.types";

interface CourseLessonsProps {
  chapters?: Chapter[];
  baseLanguageChapters?: Chapter[];
  canRefetchChapterList: boolean;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  showCourseGenerationButton: boolean;
  coursePriceInCents?: number;
  unregisteredUserCoursesAccessibility: boolean;
}

const CourseLessons = ({
  chapters,
  baseLanguageChapters,
  canRefetchChapterList,
  language,
  baseLanguage,
  showCourseGenerationButton,
  coursePriceInCents,
  unregisteredUserCoursesAccessibility,
}: CourseLessonsProps) => {
  const [contentTypeToDisplay, setContentTypeToDisplay] = useState<string>(ContentTypes.EMPTY);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const { setIsLeavingContent, isCurrentFormDirty, openLeaveModal } = useLeaveModal();
  const { id: courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAuthoringDrawerOpen = searchParams.get("aiGeneration") === "true";
  /** Preserve the curriculum route and its other filters while toggling the generation drawer. */
  const setAuthoringDrawerOpen = useCallback(
    (open: boolean) => {
      const next = new URLSearchParams(searchParams);
      if (open) next.set("aiGeneration", "true");
      else next.delete("aiGeneration");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const { hasAccess: canUseCourseAuthoring } = usePermissions({
    all: [PERMISSIONS.COURSE_AI_GENERATION],
  });

  const [isNewChapter, setIsNewChapter] = useState(false);
  const [authoringCurriculumPreview, setAuthoringCurriculumPreview] =
    useState<CurriculumPreview | null>(null);
  const [curriculumPreviewActions, setCurriculumPreviewActions] =
    useState<CurriculumPreviewActions | null>(null);
  const { t } = useTranslation();

  const availableCurriculumPreviewRef = useRef<CurriculumPreview | null>(null);

  const handleCurriculumPreviewChange = useCallback((preview: CurriculumPreview | null) => {
    availableCurriculumPreviewRef.current = preview;
    if (!preview) {
      setAuthoringCurriculumPreview(null);
      setCurriculumPreviewActions(null);
      return;
    }
    setAuthoringCurriculumPreview((activePreview) => syncReviewPreview(activePreview, preview));
  }, []);

  const handlePreviewInCurriculum = useCallback(
    (preview: PreviewView) => {
      const currentPreview = availableCurriculumPreviewRef.current;
      const curriculumPreview =
        currentPreview && currentPreview.proposalId === preview.taskId
          ? currentPreview
          : {
              proposalId: preview.taskId,
              status: "streaming" as const,
              outline: preview.outline.map((chapter, chapterIndex) => ({
                id: `${preview.taskId}:chapter:${chapterIndex}`,
                title: chapter.title,
                lessons: chapter.lessons.map((lesson, lessonIndex) => ({
                  id: `${preview.taskId}:chapter:${chapterIndex}:lesson:${lessonIndex}`,
                  title: lesson.title,
                  lessonType: lesson.lessonType,
                })),
              })),
            };
      setAuthoringCurriculumPreview(curriculumPreview);
      setCurriculumPreviewActions(null);
      setAuthoringDrawerOpen(false);
    },
    [setAuthoringDrawerOpen],
  );

  const handlePreviewProposalInCurriculum = useCallback(
    (preview: CurriculumPreview, actions: CurriculumPreviewActions) => {
      setAuthoringCurriculumPreview(preview);
      setCurriculumPreviewActions(actions);
      setAuthoringDrawerOpen(false);
    },
    [setAuthoringDrawerOpen],
  );

  /** Leaves review mode on the refreshed curriculum so the author sees the applied result. */
  const handleReviewApplied = useCallback(() => {
    setAuthoringCurriculumPreview(null);
    setCurriculumPreviewActions(null);
  }, []);

  /** Returns to the durable conversation without deciding or retaining the locked curriculum view. */
  const handleReturnToAuthoringChat = useCallback(() => {
    setAuthoringCurriculumPreview(null);
    setCurriculumPreviewActions(null);
    setAuthoringDrawerOpen(true);
  }, [setAuthoringDrawerOpen]);

  const isBaseLanguage = baseLanguage === language;
  const isCurriculumLocked = authoringCurriculumPreview !== null;
  const shouldShowAuthoringButton =
    isBaseLanguage && showCourseGenerationButton && canUseCourseAuthoring;

  const baseLanguageLesson = useMemo(() => {
    if (!selectedChapter || !selectedLesson) return null;

    return (
      baseLanguageChapters
        ?.find(({ id }) => id === selectedChapter.id)
        ?.lessons.find(({ id }) => id === selectedLesson.id) ?? null
    );
  }, [baseLanguageChapters, selectedChapter, selectedLesson]);

  const baseLanguageChapter = useMemo(
    () => baseLanguageChapters?.find(({ id }) => id === selectedChapter?.id) ?? null,
    [baseLanguageChapters, selectedChapter?.id],
  );

  useEffect(() => {
    if (!chapters) return;

    if (selectedChapter) {
      const updatedChapter = chapters.find((chapter) => chapter.id === selectedChapter.id);

      if (updatedChapter) {
        setSelectedChapter(updatedChapter);

        if (selectedLesson) {
          const updatedLesson = updatedChapter.lessons.find(
            (lesson) => lesson.id === selectedLesson.id,
          );

          if (updatedLesson) {
            setSelectedLesson(updatedLesson);
          }
        }
      }
    }
  }, [chapters, selectedChapter, selectedLesson]);

  useEffect(() => {
    setAuthoringCurriculumPreview(null);
    setCurriculumPreviewActions(null);
    availableCurriculumPreviewRef.current = null;
  }, [courseId, language]);

  useEffect(() => {
    if (!isCurriculumLocked) return;
    setContentTypeToDisplay(ContentTypes.EMPTY);
    setSelectedChapter(null);
    setSelectedLesson(null);
  }, [isCurriculumLocked]);

  const addChapter = useCallback(() => {
    if (isCurriculumLocked) return;

    if (isCurrentFormDirty) {
      setIsLeavingContent(true);
      setIsNewChapter(true);
      openLeaveModal();
      return;
    }
    setContentTypeToDisplay(ContentTypes.CHAPTER_FORM);
    setSelectedChapter(null);
  }, [
    isCurrentFormDirty,
    setIsLeavingContent,
    setIsNewChapter,
    openLeaveModal,
    setContentTypeToDisplay,
    setSelectedChapter,
    isCurriculumLocked,
  ]);

  useEffect(() => {
    if (!isCurrentFormDirty && isNewChapter) {
      addChapter();
      setIsNewChapter(false);
    }
  }, [isCurrentFormDirty, isNewChapter, addChapter]);

  const renderContent = useMemo(() => {
    const contentMap: Record<string, JSX.Element | null> = {
      [ContentTypes.EMPTY]: <CourseLessonEmptyState />,
      [ContentTypes.CHAPTER_FORM]: (
        <NewChapter
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapter={selectedChapter}
          baseLanguageChapter={baseLanguageChapter}
          language={language}
        />
      ),
      [ContentTypes.CONTENT_LESSON_FORM]: (
        <ContentLessonForm
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapterToEdit={selectedChapter}
          lessonToEdit={selectedLesson}
          baseLanguageLesson={baseLanguageLesson}
          setSelectedLesson={setSelectedLesson}
          language={language}
        />
      ),
      [ContentTypes.SELECT_LESSON_TYPE]: (
        <SelectLessonType setContentTypeToDisplay={setContentTypeToDisplay} />
      ),
      [ContentTypes.QUIZ_FORM]: (
        <QuizLessonForm
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapterToEdit={selectedChapter}
          lessonToEdit={selectedLesson}
          baseLanguageLesson={baseLanguageLesson}
          setSelectedLesson={setSelectedLesson}
          language={language}
          baseLanguage={baseLanguage}
        />
      ),
      [ContentTypes.AI_MENTOR_FORM]: (
        <AiMentorLessonForm
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapterToEdit={selectedChapter}
          lessonToEdit={selectedLesson}
          baseLanguageLesson={baseLanguageLesson}
          setSelectedLesson={setSelectedLesson}
          language={language}
          baseLanguage={baseLanguage}
        />
      ),
      [ContentTypes.EMBED_FORM]: (
        <EmbedLessonForm
          lessonToEdit={selectedLesson}
          baseLanguageLesson={baseLanguageLesson}
          chapterToEdit={selectedChapter}
          setContentTypeToDisplay={setContentTypeToDisplay}
          setSelectedLesson={setSelectedLesson}
          language={language}
        />
      ),
      [ContentTypes.SCORM_LESSON_FORM]: (
        <ScormLessonForm
          lessonToEdit={selectedLesson}
          baseLanguageLesson={baseLanguageLesson}
          chapterToEdit={selectedChapter}
          setContentTypeToDisplay={setContentTypeToDisplay}
          setSelectedLesson={setSelectedLesson}
          language={language}
        />
      ),
      [ContentTypes.LIVE_TRAINING_LESSON_FORM]: (
        <LiveTrainingLessonForm
          lessonToEdit={selectedLesson}
          baseLanguageLesson={baseLanguageLesson}
          chapterToEdit={selectedChapter}
          setContentTypeToDisplay={setContentTypeToDisplay}
          setSelectedLesson={setSelectedLesson}
          language={language}
        />
      ),
    };
    return contentMap[contentTypeToDisplay] || null;
  }, [
    contentTypeToDisplay,
    selectedChapter,
    selectedLesson,
    baseLanguageLesson,
    baseLanguageChapter,
    language,
    baseLanguage,
  ]);

  const sortableChapters: Sortable<Chapter>[] = useMemo(
    () => chapters?.map((chapter) => ({ ...chapter, sortableId: chapter.id })) ?? [],
    [chapters],
  );
  const isAddChapterDisabled = !isBaseLanguage || isCurriculumLocked;
  const isLessonExitGuardEnabled = isCurrentFormDirty;

  return (
    <div
      data-testid={CURRICULUM_HANDLES.ROOT}
      className={cn(
        "flex basis-full flex-col gap-8 rounded-lg md:flex-row md:items-start",
        authoringCurriculumPreview && "md:flex-col md:items-stretch",
      )}
    >
      <UnsavedChangesExitGuard
        enabled={isLessonExitGuardEnabled}
        dialogTitle={t("adminCourseView.curriculum.lesson.other.leaveContentHeader")}
        message={t("adminCourseView.curriculum.lesson.other.leaveContentBody")}
        cancelLabel={t("adminCourseView.curriculum.lesson.other.leaveContentCancel")}
        leaveLabel={t("adminCourseView.curriculum.lesson.other.leaveContentDiscard")}
      />
      {authoringCurriculumPreview ? (
        <CurriculumReviewWorkspace
          key={authoringCurriculumPreview.proposalId}
          chapters={chapters ?? []}
          preview={authoringCurriculumPreview}
          actions={curriculumPreviewActions}
          courseId={courseId}
          language={language}
          baseLanguage={baseLanguage}
          onExit={handleReturnToAuthoringChat}
          onApplied={handleReviewApplied}
        />
      ) : (
        <>
          <div className="flex w-full flex-col justify-between overflow-y-auto md:w-[480px] md:shrink-0 md:basis-[480px]">
            <div className="flex flex-col">
              <ChaptersList
                canRefetchChapterList={canRefetchChapterList}
                chapters={sortableChapters}
                baseLanguageChapters={baseLanguageChapters}
                setContentTypeToDisplay={setContentTypeToDisplay}
                setSelectedChapter={setSelectedChapter}
                setSelectedLesson={setSelectedLesson}
                selectedChapter={selectedChapter}
                selectedLesson={selectedLesson}
                language={language}
                baseLanguage={baseLanguage}
                isCourseGenerationLocked={isCurriculumLocked}
                coursePriceInCents={coursePriceInCents}
                unregisteredUserCoursesAccessibility={unregisteredUserCoursesAccessibility}
              />
            </div>
            <div className="mt-4 flex w-full gap-3">
              {!isBaseLanguage ? (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn(shouldShowAuthoringButton ? "w-1/2" : "w-full")}>
                        <Button
                          data-testid={CURRICULUM_HANDLES.ADD_CHAPTER_BUTTON}
                          onClick={addChapter}
                          disabled
                          className="w-full rounded-lg px-4 py-2"
                        >
                          <Icon name="Plus" className="mr-2" />
                          {t("adminCourseView.curriculum.chapter.button.addChapter")}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("adminCourseView.curriculum.chapter.button.addChapterDisabledTooltip")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  data-testid={CURRICULUM_HANDLES.ADD_CHAPTER_BUTTON}
                  onClick={addChapter}
                  disabled={isAddChapterDisabled}
                  className={cn(
                    "rounded-lg px-4 py-2",
                    shouldShowAuthoringButton ? "w-1/2" : "w-full",
                  )}
                >
                  <Icon name="Plus" className="mr-2" />
                  {t("adminCourseView.curriculum.chapter.button.addChapter")}
                </Button>
              )}
              {shouldShowAuthoringButton && courseId && (
                <div className="w-1/2 space-y-1">
                  <Button
                    onClick={() => setAuthoringDrawerOpen(true)}
                    type="button"
                    variant="outline"
                    className="w-full gap-2 rounded-lg px-4 py-2"
                    data-testid={CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON}
                  >
                    <Icon name="WandSparkles" className="size-4" />
                    {t("courseAuthoring.openWorkspace")}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1 self-start md:sticky md:top-8">{renderContent}</div>
        </>
      )}
      {shouldShowAuthoringButton && courseId && (
        <CourseGenerationDrawer
          courseId={courseId}
          language={language}
          open={isAuthoringDrawerOpen}
          onOpenChange={setAuthoringDrawerOpen}
          onPreviewInCurriculum={handlePreviewInCurriculum}
          onPreviewProposalInCurriculum={handlePreviewProposalInCurriculum}
          onCurriculumPreviewChange={handleCurriculumPreviewChange}
        />
      )}
    </div>
  );
};

export default CourseLessons;
