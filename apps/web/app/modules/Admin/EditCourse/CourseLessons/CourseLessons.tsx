import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { useLeaveModal } from "~/context/LeaveModalContext";

import { ContentTypes } from "../EditCourse.types";

import ChaptersList from "./components/ChaptersList";
import CourseLessonEmptyState from "./components/CourseLessonEmptyState";
import NewChapter from "./NewChapter/NewChapter";
import SelectLessonType from "./NewLesson/components/SelectLessonType";
import FileLessonForm from "./NewLesson/FileLessonForm/FileLessonForm";
import QuizLessonForm from "./NewLesson/QuizLessonForm/QuizLessonForm";
import TextLessonForm from "./NewLesson/TextLessonForm/TextLessonForm";

import type { Chapter, Lesson } from "../EditCourse.types";
import type { Sortable } from "~/components/SortableList/SortableList";

interface CourseLessonsProps {
  chapters?: Chapter[];
  canRefetchChapterList: boolean;
}

const CourseLessons = ({ chapters, canRefetchChapterList }: CourseLessonsProps) => {
  const [contentTypeToDisplay, setContentTypeToDisplay] = useState(ContentTypes.EMPTY);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const { setIsLeavingContent, isCurrentFormDirty, openLeaveModal } = useLeaveModal();
  const [isNewChapter, setIsNewChapter] = useState(false);
  const { t } = useTranslation();

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
        <NewChapter setContentTypeToDisplay={setContentTypeToDisplay} chapter={selectedChapter} />
      ),
      [ContentTypes.VIDEO_LESSON_FORM]: (
        <FileLessonForm
          contentTypeToDisplay={contentTypeToDisplay}
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapterToEdit={selectedChapter}
          lessonToEdit={selectedLesson}
          setSelectedLesson={setSelectedLesson}
        />
      ),
      [ContentTypes.PRESENTATION_FORM]: (
        <FileLessonForm
          contentTypeToDisplay={contentTypeToDisplay}
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapterToEdit={selectedChapter}
          lessonToEdit={selectedLesson}
          setSelectedLesson={setSelectedLesson}
        />
      ),
      [ContentTypes.TEXT_LESSON_FORM]: (
        <TextLessonForm
          setContentTypeToDisplay={setContentTypeToDisplay}
          chapterToEdit={selectedChapter}
          lessonToEdit={selectedLesson}
          setSelectedLesson={setSelectedLesson}
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
        />
      ),
    };
    return contentMap[contentTypeToDisplay] || null;
  }, [contentTypeToDisplay, selectedChapter, selectedLesson]);

  const sortableChapters: Sortable<Chapter>[] = useMemo(
    () => chapters?.map((chapter) => ({ ...chapter, sortableId: chapter.id })) ?? [],
    [chapters],
  );

  return (
    <div className="flex h-full basis-full gap-x-8 rounded-lg">
      <div className="flex h-full w-full flex-col justify-between md:max-w-[480px]">
        <div className="flex h-full flex-col overflow-y-auto">
          <ChaptersList
            canRefetchChapterList={canRefetchChapterList}
            chapters={sortableChapters}
            setContentTypeToDisplay={setContentTypeToDisplay}
            setSelectedChapter={setSelectedChapter}
            setSelectedLesson={setSelectedLesson}
            selectedChapter={selectedChapter}
            selectedLesson={selectedLesson}
          />
        </div>
        <Button
          onClick={addChapter}
          className="rounded-lg bg-primary-700 px-4 py-2 text-white hover:bg-blue-600"
        >
          <Icon name="Plus" className="mr-2" />
          {t("adminCourseView.curriculum.chapter.button.addChapter")}
        </Button>
      </div>
      <div className="h-auto w-full overflow-y-auto">{renderContent}</div>
    </div>
  );
};

export default CourseLessons;
