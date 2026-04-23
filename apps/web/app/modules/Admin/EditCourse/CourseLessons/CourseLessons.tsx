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
import { cn } from "~/lib/utils";
import { CourseGenerationButton } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationButton";
import { CourseGenerationChatRuntime } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationChatRuntime";
import { CourseGenerationCompletedNotice } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationCompletedNotice";
import { CourseGenerationExitGuard } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationExitGuard";
import { CourseGenerationProgressStrip } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationProgressStrip";

import { CURRICULUM_HANDLES } from "../../../../../e2e/data/curriculum/handles";
import { ContentTypes } from "../EditCourse.types";

import ChaptersList from "./components/ChaptersList";
import { CourseGenerationChapterSkeletons } from "./components/CourseGenerationChapterSkeletons";
import CourseLessonEmptyState from "./components/CourseLessonEmptyState";
import NewChapter from "./NewChapter/NewChapter";
import AiMentorLessonForm from "./NewLesson/AiMentorLessonForm/AiMentorLessonForm";
import SelectLessonType from "./NewLesson/components/SelectLessonType";
import ContentLessonForm from "./NewLesson/ContentLessonForm/ContentLessonForm";
import { EmbedLessonForm } from "./NewLesson/EmbedLessonForm/EmbedLessonForm";
import QuizLessonForm from "./NewLesson/QuizLessonForm/QuizLessonForm";

import type { Chapter, Lesson } from "../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";
import type { GetCourseGenerationDraftResponse } from "~/api/generated-api";
import type { Sortable } from "~/components/SortableList/SortableList";

interface CourseLessonsProps {
  chapters?: Chapter[];
  canRefetchChapterList: boolean;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  isCourseGenerationDisabled: boolean;
  showCourseGenerationButton: boolean;
  isCourseGenerated: boolean;
  onCourseGenerationFinished: () => void;
  draft?: GetCourseGenerationDraftResponse;
}

const CourseLessons = ({
  chapters,
  canRefetchChapterList,
  language,
  baseLanguage,
  draft,
  isCourseGenerationDisabled,
  showCourseGenerationButton,
  isCourseGenerated,
  onCourseGenerationFinished,
}: CourseLessonsProps) => {
  const [contentTypeToDisplay, setContentTypeToDisplay] = useState(ContentTypes.EMPTY);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const { setIsLeavingContent, isCurrentFormDirty, openLeaveModal } = useLeaveModal();

  const [isNewChapter, setIsNewChapter] = useState(false);
  const [isGenerationDrawerOpen, setIsGenerationDrawerOpen] = useState(false);
  const [isBackgroundGenerating, setIsBackgroundGenerating] = useState(false);
  const [isGenerationProcessing, setIsGenerationProcessing] = useState(false);
  const [currentGenerationMessageKey, setCurrentGenerationMessageKey] = useState<string | null>(
    null,
  );
  const [showGenerationCompletedNotice, setShowGenerationCompletedNotice] = useState(false);
  const hasSeenGeneratedRef = useRef(isCourseGenerated);
  const { t } = useTranslation();

  const isBaseLanguage = baseLanguage === language;
  const shouldUnmountCourseGenerationButton =
    !isBaseLanguage || !showCourseGenerationButton || isCourseGenerated;
  const shouldShowCourseGenerationButton =
    !shouldUnmountCourseGenerationButton && !isCourseGenerationDisabled;

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
    if (!isCourseGenerated) return;
    setIsBackgroundGenerating(false);
    setIsGenerationProcessing(false);
    setCurrentGenerationMessageKey(null);
    setIsGenerationDrawerOpen(false);
  }, [isCourseGenerated]);

  useEffect(() => {
    if (!hasSeenGeneratedRef.current && isCourseGenerated) {
      setShowGenerationCompletedNotice(true);
    }
    hasSeenGeneratedRef.current = isCourseGenerated;
  }, [isCourseGenerated]);

  const addChapter = useCallback(() => {
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
          language={language}
        />
      ),
      [ContentTypes.CONTENT_LESSON_FORM]: (
        <ContentLessonForm
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapterToEdit={selectedChapter}
          lessonToEdit={selectedLesson}
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
          setSelectedLesson={setSelectedLesson}
          language={language}
        />
      ),
      [ContentTypes.EMBED_FORM]: (
        <EmbedLessonForm
          lessonToEdit={selectedLesson}
          chapterToEdit={selectedChapter}
          setContentTypeToDisplay={setContentTypeToDisplay}
          setSelectedLesson={setSelectedLesson}
          language={language}
        />
      ),
    };
    return contentMap[contentTypeToDisplay] || null;
  }, [contentTypeToDisplay, selectedChapter, selectedLesson, language, baseLanguage]);

  const sortableChapters: Sortable<Chapter>[] = useMemo(
    () => chapters?.map((chapter) => ({ ...chapter, sortableId: chapter.id })) ?? [],
    [chapters],
  );
  const shouldShowGenerationSkeletons =
    isBackgroundGenerating && sortableChapters.length === 0 && !isCourseGenerated;
  const shouldShowProgressStrip = isBackgroundGenerating && !isCourseGenerated;

  const handleGenerationProcessingStateChange = useCallback(
    (state: { currentMessageKey: string | null; isProcessing: boolean }) => {
      setCurrentGenerationMessageKey(state.currentMessageKey);
      setIsGenerationProcessing(state.isProcessing);
      if (state.isProcessing) {
        setShowGenerationCompletedNotice(false);
      }
    },
    [],
  );
  const handleGenerationInvalidate = useCallback(() => {
    setSelectedLesson(null);
  }, []);
  const isExitGuardEnabled =
    (isGenerationProcessing || isBackgroundGenerating) && !isCourseGenerated;

  return (
    <div
      data-testid={CURRICULUM_HANDLES.ROOT}
      className="flex basis-full gap-x-8 rounded-lg md:items-start"
    >
      <CourseGenerationExitGuard enabled={isExitGuardEnabled} />
      <div className="flex w-full overflow-y-auto flex-col justify-between md:max-w-[480px]">
        <CourseGenerationProgressStrip
          visible={shouldShowProgressStrip}
          currentMessageKey={currentGenerationMessageKey}
        />
        <CourseGenerationCompletedNotice
          visible={showGenerationCompletedNotice}
          onDismiss={() => setShowGenerationCompletedNotice(false)}
        />
        <div className="flex flex-col">
          {shouldShowGenerationSkeletons ? (
            <CourseGenerationChapterSkeletons />
          ) : (
            <ChaptersList
              canRefetchChapterList={canRefetchChapterList}
              chapters={sortableChapters}
              setContentTypeToDisplay={setContentTypeToDisplay}
              setSelectedChapter={setSelectedChapter}
              setSelectedLesson={setSelectedLesson}
              selectedChapter={selectedChapter}
              selectedLesson={selectedLesson}
              language={language}
              baseLanguage={baseLanguage}
            />
          )}
        </div>
        <div className="mt-4 flex w-full gap-3">
          {!isBaseLanguage ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(shouldShowCourseGenerationButton ? "w-1/2" : "w-full")}>
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
              disabled={!isBaseLanguage}
              className={cn(
                "rounded-lg px-4 py-2",
                shouldShowCourseGenerationButton ? "w-1/2" : "w-full",
              )}
            >
              <Icon name="Plus" className="mr-2" />
              {t("adminCourseView.curriculum.chapter.button.addChapter")}
            </Button>
          )}
          {shouldShowCourseGenerationButton && (
            <CourseGenerationButton
              testId={CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON}
              className="w-1/2"
              onClick={() => setIsGenerationDrawerOpen(true)}
            />
          )}
        </div>
      </div>
      <CourseGenerationChatRuntime
        draft={draft}
        shouldRenderDrawer={!shouldUnmountCourseGenerationButton}
        open={isGenerationDrawerOpen}
        onOpenChange={setIsGenerationDrawerOpen}
        onBackgroundGenerationStateChange={setIsBackgroundGenerating}
        onInvalidate={handleGenerationInvalidate}
        onGenerationFinished={() => {
          onCourseGenerationFinished();
        }}
        onProcessingStateChange={handleGenerationProcessingStateChange}
      />
      <div className="size-full md:sticky md:top-8 self-start">{renderContent}</div>
    </div>
  );
};

export default CourseLessons;
