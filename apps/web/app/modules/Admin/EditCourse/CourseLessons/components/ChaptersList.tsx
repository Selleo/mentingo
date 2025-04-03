import * as Switch from "@radix-ui/react-switch";
import { useParams } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import { useChangeChapterDisplayOrder } from "~/api/mutations/admin/changeChapterDisplayOrder";
import { useUpdateLessonFreemiumStatus } from "~/api/mutations/admin/useUpdateLessonFreemiumStatus";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList/SortableList";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useLeaveModal } from "~/context/LeaveModalContext";
import { cn } from "~/lib/utils";
import { LessonCardList } from "~/modules/Admin/EditCourse/CourseLessons/components/LessonCardList";

import { ContentTypes } from "../../EditCourse.types";

import type { Chapter, Lesson } from "../../EditCourse.types";
import type React from "react";

interface ChapterCardProps {
  chapter: Chapter;
  isOpen: boolean;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setSelectedChapter: (selectedChapter: Chapter | null) => void;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  selectedChapter: Chapter | null;
  selectedLesson: Lesson | null;
  dragTrigger: React.ReactNode;
}

const ChapterCard = ({
  chapter,
  isOpen,
  setContentTypeToDisplay,
  setSelectedChapter,
  setSelectedLesson,
  selectedChapter,
  selectedLesson,
  dragTrigger,
}: ChapterCardProps) => {
  const { mutateAsync: updateFreemiumStatus } = useUpdateLessonFreemiumStatus();
  const { id } = useParams();
  const { openLeaveModal, isCurrentFormDirty, setIsLeavingContent } = useLeaveModal();
  const [isNewLesson, setIsNewLesson] = useState(false);
  const [pendingChapter, setPendingChapter] = useState<Chapter | null>(null);
  const { t } = useTranslation();

  const addLessonLogic = useCallback(() => {
    setSelectedLesson(null);
    setContentTypeToDisplay(ContentTypes.SELECT_LESSON_TYPE);
    setSelectedChapter(chapter);
  }, [chapter, setContentTypeToDisplay, setSelectedChapter, setSelectedLesson]);

  const handleAddLessonClick = useCallback(
    (event: React.MouseEvent) => {
      if (isCurrentFormDirty) {
        setIsNewLesson(true);
        openLeaveModal();
        return;
      }
      event.stopPropagation();
      addLessonLogic();
    },
    [openLeaveModal, addLessonLogic, isCurrentFormDirty],
  );

  const onClickChapterCard = useCallback(() => {
    if (isCurrentFormDirty) {
      setPendingChapter(chapter);
      setIsLeavingContent(true);
      openLeaveModal();
      return;
    }
    setContentTypeToDisplay(ContentTypes.CHAPTER_FORM);
    setSelectedChapter(chapter);
    setSelectedLesson(null);
  }, [
    chapter,
    setContentTypeToDisplay,
    setSelectedChapter,
    openLeaveModal,
    isCurrentFormDirty,
    setIsLeavingContent,
    setSelectedLesson,
  ]);

  const onAccordionClick = useCallback(
    (event: React.MouseEvent) => {
      setSelectedChapter(chapter);
      event.stopPropagation();
    },
    [chapter, setSelectedChapter],
  );

  useEffect(() => {
    if (!isCurrentFormDirty && pendingChapter) {
      onClickChapterCard();
      setPendingChapter(null);
      setIsLeavingContent(false);
    }
  }, [isCurrentFormDirty, pendingChapter, onClickChapterCard, setIsLeavingContent]);

  useEffect(() => {
    if (!isCurrentFormDirty && isNewLesson) {
      addLessonLogic();
      setIsNewLesson(false);
    }
  }, [isCurrentFormDirty, isNewLesson, addLessonLogic]);

  const onSwitchClick = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      try {
        await updateFreemiumStatus({
          chapterId: chapter.id,
          data: { isFreemium: !chapter.isFree },
        });
        queryClient.invalidateQueries({
          queryKey: [COURSE_QUERY_KEY, { id }],
        });
      } catch (error) {
        console.error("Failed to update chapter premium status:", error);
      }
    },
    [chapter, updateFreemiumStatus, id],
  );

  return (
    <AccordionItem key={chapter.id} data-chapter-id={chapter.id} value={chapter.id} className="p-0">
      <Card
        className={cn("mb-4 flex h-full border p-4", {
          "border-primary-500": isOpen || selectedChapter?.id === chapter.id,
        })}
        onClick={onClickChapterCard}
      >
        <div className="flex w-full">
          <div className="ml-2 flex flex-1 flex-col justify-between">
            <div className="flex items-center gap-x-3">
              {dragTrigger}
              <hgroup className="flex w-full flex-col-reverse">
                <h3 className="body-base-md text-neutral-950">{chapter.title}</h3>
                <div className="body-sm-md text-neutral-800">
                  {t("adminCourseView.curriculum.other.chapter")} {chapter.displayOrder} •{" "}
                  {t("adminCourseView.curriculum.other.lessonNumber")} {chapter.lessons.length}
                </div>
              </hgroup>
              <AccordionTrigger
                className="cursor-pointer p-2"
                data-testid={`accordion - ${chapter.id}`}
                onClick={onAccordionClick}
              >
                <Icon name={isOpen ? "ArrowUp" : "ArrowDown"} className="text-gray-600" />
              </AccordionTrigger>
            </div>
            <AccordionContent className="mt-2 text-gray-700">
              {chapter.lessonCount > 0 ? (
                <LessonCardList
                  lessons={chapter.lessons.map((lesson) => ({ ...lesson, sortableId: lesson.id }))}
                  selectedLesson={selectedLesson}
                  setSelectedLesson={setSelectedLesson}
                  setContentTypeToDisplay={setContentTypeToDisplay}
                />
              ) : (
                <div className="ml-9">No lessons</div>
              )}
            </AccordionContent>
            <div className="mt-3 flex items-center justify-between">
              <div
                className={cn("flex items-center space-x-2", {
                  "ml-9": !isOpen || chapter.lessons.length === 0,
                })}
              >
                <Button variant="outline" onClick={handleAddLessonClick}>
                  <Icon name="Plus" className="mr-2 text-primary-800" />
                  {t("adminCourseView.curriculum.lesson.button.addLesson")}
                </Button>
              </div>
              <div className="flex items-center gap-x-2">
                <Switch.Root
                  data-testid={`Freemium - ${chapter.id}`}
                  className={cn("relative h-6 w-11 rounded-full transition-colors", {
                    "bg-blue-500": chapter.isFree,
                    "bg-gray-200": !chapter.isFree,
                  })}
                  onClick={onSwitchClick}
                  checked={chapter.isFree}
                >
                  <Switch.Thumb
                    className={cn(
                      "block h-4 w-4 translate-x-1 transform rounded-full bg-white transition-transform",
                      chapter.isFree ? "translate-x-6" : "",
                    )}
                  />
                </Switch.Root>
                <span className="body-sm-md text-neutral-950">
                  {t("adminCourseView.curriculum.chapter.other.freemium")}
                </span>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Icon name="Info" className="h-auto w-6 cursor-default text-neutral-800" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("adminCourseView.curriculum.chapter.other.freemiumToolTip")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </AccordionItem>
  );
};

type DraggableChapter = Chapter & { sortableId: string };

type ChaptersListProps = {
  chapters?: DraggableChapter[];
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setSelectedChapter: (selectedChapter: Chapter | null) => void;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  selectedChapter: Chapter | null;
  selectedLesson: Lesson | null;
  canRefetchChapterList: boolean;
  isLeaveModalOpen?: boolean;
};

function getChapterWithLatestLesson(chapters: Chapter[]): string | null {
  let latestTime = 0;
  let latestChapterId: string | null = null;

  chapters.map((chapter) => {
    const chapterTime = chapter.updatedAt ? new Date(chapter.updatedAt).getTime() : 0;

    chapter.lessons.map((lesson) => {
      const lessonTime = new Date(lesson.updatedAt).getTime();
      if (lessonTime > latestTime) {
        latestTime = lessonTime;
        latestChapterId = chapter.id;
      }
    });

    if (chapterTime > latestTime) {
      latestTime = chapterTime;
      latestChapterId = chapter.id;
    }
  });

  return latestChapterId;
}

const ChaptersList = ({
  chapters,
  setContentTypeToDisplay,
  setSelectedChapter,
  setSelectedLesson,
  selectedChapter,
  selectedLesson,
  canRefetchChapterList,
}: ChaptersListProps) => {
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);
  const [items, setItems] = useState(chapters);
  const mutation = useChangeChapterDisplayOrder();
  const chapterId = getChapterWithLatestLesson(chapters ?? []);

  useEffect(() => {
    setItems(chapters);

    if (canRefetchChapterList) {
      chapterId && setOpenItem(chapterId);
    }
  }, [chapters, canRefetchChapterList, chapterId]);

  if (!items) return;

  return (
    <Accordion
      type="single"
      collapsible
      value={openItem}
      onValueChange={setOpenItem}
      defaultValue={openItem}
    >
      <SortableList
        items={items}
        onChange={(updatedItems, newChapterPosition, newDisplayOrder) => {
          flushSync(() => {
            setItems(updatedItems);

            mutation.mutate({
              chapter: {
                chapterId: updatedItems[newChapterPosition].sortableId,
                displayOrder: newDisplayOrder,
              },
            });
          });
        }}
        className="grid grid-cols-1"
        renderItem={(chapter) => (
          <SortableList.Item id={chapter.sortableId} data-id={chapter.id}>
            <ChapterCard
              key={chapter.sortableId}
              chapter={chapter}
              isOpen={openItem === chapter.sortableId}
              setContentTypeToDisplay={setContentTypeToDisplay}
              setSelectedChapter={setSelectedChapter}
              setSelectedLesson={setSelectedLesson}
              selectedLesson={selectedLesson}
              selectedChapter={selectedChapter}
              dragTrigger={
                <SortableList.DragHandle>
                  <Icon name="DragAndDropIcon" className="cursor-move" />
                </SortableList.DragHandle>
              }
            />
          </SortableList.Item>
        )}
      />
    </Accordion>
  );
};

export default ChaptersList;
