import { useParams } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useChangeLessonDisplayOrder } from "~/api/mutations/admin/changeLessonDisplayOrder";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList/SortableList";
import { useLeaveModal } from "~/context/LeaveModalContext";
import LessonCard from "~/modules/Admin/EditCourse/CourseLessons/components/LessonCard";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import type { Sortable } from "~/components/SortableList/SortableList";
import type { Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

type LessonCardListProps = {
  setSelectedLesson: (lesson: Lesson) => void;
  setContentTypeToDisplay: (contentType: string) => void;
  lessons: Sortable<Lesson>[];
  selectedLesson: Lesson | null;
};

export const LessonCardList = ({
  lessons,
  setSelectedLesson,
  setContentTypeToDisplay,
  selectedLesson,
}: LessonCardListProps) => {
  const { id: courseId } = useParams();
  const { mutateAsync: mutateLessonDisplayOrder } = useChangeLessonDisplayOrder();
  const { openLeaveModal, isCurrentFormDirty, setIsLeavingContent } = useLeaveModal();
  const [pendingLesson, setPendingLesson] = useState<Lesson | null>(null);
  const { t } = useTranslation();

  const onClickLessonCard = useCallback(
    (lesson: Lesson) => {
      if (isCurrentFormDirty) {
        setPendingLesson(lesson);
        setIsLeavingContent(true);
        openLeaveModal();
        return;
      }

      const contentType = lesson.type === "file" ? lesson.fileType : lesson.type;
      setSelectedLesson(lesson);
      switch (contentType) {
        case "video":
          setContentTypeToDisplay(ContentTypes.VIDEO_LESSON_FORM);
          break;
        case "text":
          setContentTypeToDisplay(ContentTypes.TEXT_LESSON_FORM);
          break;
        case "presentation":
          setContentTypeToDisplay(ContentTypes.PRESENTATION_FORM);
          break;
        case "quiz":
          setContentTypeToDisplay(ContentTypes.QUIZ_FORM);
          break;
        case "ai":
          setContentTypeToDisplay(ContentTypes.AI_MENTOR_FORM);
          break;
        default:
          setContentTypeToDisplay(ContentTypes.EMPTY);
      }
    },
    [
      isCurrentFormDirty,
      setContentTypeToDisplay,
      setSelectedLesson,
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
      await mutateLessonDisplayOrder({
        lesson: {
          lessonId: updatedItems[newChapterPosition].sortableId,
          displayOrder: newDisplayOrder,
        },
      });

      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
    },
    [courseId, mutateLessonDisplayOrder],
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
      items={lessons}
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
