import { useCallback, useEffect, useMemo, useState } from "react";
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

import { ContentTypes } from "../EditCourse.types";

import ChaptersList from "./components/ChaptersList";
import CourseLessonEmptyState from "./components/CourseLessonEmptyState";
import NewChapter from "./NewChapter/NewChapter";
import AiMentorLessonForm from "./NewLesson/AiMentorLessonForm/AiMentorLessonForm";
import SelectLessonType from "./NewLesson/components/SelectLessonType";
import ContentLessonForm from "./NewLesson/ContentLessonForm/ContentLessonForm";
import { EmbedLessonForm } from "./NewLesson/EmbedLessonForm/EmbedLessonForm";
import QuizLessonForm from "./NewLesson/QuizLessonForm/QuizLessonForm";

import type { Chapter, Lesson } from "../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";
import type { Sortable } from "~/components/SortableList/SortableList";

interface CourseLessonsProps {
  chapters?: Chapter[];
  canRefetchChapterList: boolean;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
}

const CourseLessons = ({
  chapters,
  canRefetchChapterList,
  language,
  baseLanguage,
}: CourseLessonsProps) => {
  const [contentTypeToDisplay, setContentTypeToDisplay] = useState(ContentTypes.EMPTY);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const { setIsLeavingContent, isCurrentFormDirty, openLeaveModal } = useLeaveModal();

  const [isNewChapter, setIsNewChapter] = useState(false);
  const { t } = useTranslation();

  const isBaseLanguage = baseLanguage === language;

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

  return (
    <div className="flex basis-full gap-x-8 rounded-lg md:items-start">
      <div className="flex w-full overflow-y-auto flex-col justify-between md:max-w-[480px]">
        <div className="flex flex-col">
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
        </div>
        {!isBaseLanguage ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button onClick={addChapter} className="rounded-lg px-4 py-2 w-full" disabled>
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
          <Button onClick={addChapter} className="rounded-lg px-4 py-2">
            <Icon name="Plus" className="mr-2" />
            {t("adminCourseView.curriculum.chapter.button.addChapter")}
          </Button>
        )}
      </div>
      <div className="size-full md:sticky md:top-4 self-start">{renderContent}</div>
    </div>
  );
};

export default CourseLessons;
