import { useParams } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useChangeLessonDisplayOrder } from "~/api/mutations/admin/changeLessonDisplayOrder";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { getCourseQueryKey } from "~/api/queries/useCourse";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList/SortableList";
import { useLeaveModal } from "~/context/LeaveModalContext";
import LessonCard from "~/modules/Admin/EditCourse/CourseLessons/components/LessonCard";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import type { SupportedLanguages } from "@repo/shared";
import type { Sortable } from "~/components/SortableList/SortableList";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

type LessonCardListProps = {
  setSelectedLesson: (lesson: Lesson) => void;
  setContentTypeToDisplay: (contentType: string) => void;
  setSelectedChapter?: (chapter: Chapter | null) => void;
  chapter?: Chapter;
  lessons: Sortable<Lesson>[];
  selectedLesson: Lesson | null;
  language: SupportedLanguages;
};

export const LessonCardList = ({
  lessons,
  setSelectedLesson,
  setContentTypeToDisplay,
  setSelectedChapter,
  chapter,
  selectedLesson,
  language,
}: LessonCardListProps) => {
  const { id: courseId } = useParams();
  const { mutateAsync: mutateLessonDisplayOrder } = useChangeLessonDisplayOrder();
  const { openLeaveModal, isCurrentFormDirty, setIsLeavingContent } = useLeaveModal();
  const [pendingLesson, setPendingLesson] = useState<Lesson | null>(null);
  const [lessonsList, setLessonsList] = useState<Sortable<Lesson>[]>(lessons);
  const { t } = useTranslation();

  useEffect(() => {
    setLessonsList(lessons);
  }, [lessons]);

  const onClickLessonCard = useCallback(
    (lesson: Lesson) => {
      if (isCurrentFormDirty) {
        setPendingLesson(lesson);
        setIsLeavingContent(true);
        openLeaveModal();
        return;
      }

      if (setSelectedChapter && chapter) {
        setSelectedChapter(chapter);
      }

      setSelectedLesson(lesson);
      switch (lesson.type) {
        case "content":
          setContentTypeToDisplay(ContentTypes.CONTENT_LESSON_FORM);
          break;
        case "quiz":
          setContentTypeToDisplay(ContentTypes.QUIZ_FORM);
          break;
        case "ai_mentor":
          setContentTypeToDisplay(ContentTypes.AI_MENTOR_FORM);
          break;
        case "embed":
          setContentTypeToDisplay(ContentTypes.EMBED_FORM);
          break;
        default:
          setContentTypeToDisplay(ContentTypes.EMPTY);
      }
    },
    [
      isCurrentFormDirty,
      setContentTypeToDisplay,
      setSelectedLesson,
      setSelectedChapter,
      chapter,
      openLeaveModal,
      setIsLeavingContent,
    ],
  );

  const handleOrderChange = useCallback(
    async (
      updatedItems: Sortable<Lesson>[],
      newChapterPosition: number,
      newDisplayOrder: number,
    ) => {
      setLessonsList(updatedItems);

      await mutateLessonDisplayOrder({
        lesson: {
          lessonId: updatedItems[newChapterPosition].sortableId,
          displayOrder: newDisplayOrder,
        },
      });

      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
      await queryClient.invalidateQueries({ queryKey: getCourseQueryKey(courseId!, language) });
      await queryClient.invalidateQueries({ queryKey: ["course"] });
    },
    [courseId, mutateLessonDisplayOrder, language],
  );

  useEffect(() => {
    if (!isCurrentFormDirty && pendingLesson) {
      onClickLessonCard(pendingLesson);
      setPendingLesson(null);
      setIsLeavingContent(false);
    }
  }, [isCurrentFormDirty, pendingLesson, onClickLessonCard, setIsLeavingContent]);

  if (!lessons.length) {
    return <div className="ml-9">{t("adminCoursesView.other.noLessons")}</div>;
  }

  return (
    <SortableList
      items={lessonsList}
      onChange={handleOrderChange}
      className="mt-4 grid grid-cols-1 gap-4"
      renderItem={(item) => (
        <SortableList.Item id={item.sortableId}>
          <LessonCard
            key={item.sortableId}
            item={item}
            onClickLessonCard={onClickLessonCard}
            selectedLesson={selectedLesson}
            dragTrigger={
              <SortableList.DragHandle>
                <Icon name="DragAndDropIcon" className="cursor-move" />
              </SortableList.DragHandle>
            }
          />
        </SortableList.Item>
      )}
    />
  );
};
