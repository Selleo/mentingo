import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import ChaptersList from "~/modules/Admin/EditCourse/CourseLessons/components/ChaptersList";

import { reviewNodeKey } from "./buildCurriculumReview";
import { REVIEW_CHANGE_KIND, REVIEW_NODE_TYPE } from "./curriculumReview.constants";
import { proposedLesson } from "./proposedLesson";
import { ReviewCardMarker, reviewAccentClass } from "./ReviewChangeBadge";
import { nodeDecision } from "./reviewDecisions";

import type {
  CurriculumReviewMarker,
  CurriculumReviewModel,
  ReviewChapterNode,
  ReviewLessonNode,
} from "./curriculumReview.types";
import type { StagedDecisions } from "./reviewDecisions";
import type { SupportedLanguages } from "@repo/shared";
import type { Sortable } from "~/components/SortableList/SortableList";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

type Props = {
  model: CurriculumReviewModel;
  decisions: StagedDecisions;
  selectedKey: string | null;
  changesOnly: boolean;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  onSelect: (key: string) => void;
};

const noop = () => undefined;

const hasChanges = (chapter: ReviewChapterNode) =>
  chapter.kind !== REVIEW_CHANGE_KIND.UNCHANGED ||
  chapter.lessons.some((lesson) => lesson.kind !== REVIEW_CHANGE_KIND.UNCHANGED);

const toLesson = (node: ReviewLessonNode, index: number): Lesson => ({
  ...(proposedLesson(node) ??
    node.current ?? {
      id: node.id,
      type: node.lessonType as Lesson["type"],
      description: "",
      updatedAt: "",
    }),
  title: node.title,
  displayOrder: index,
  chapterId: node.chapterId,
});

/** Renders the proposal in the native curriculum list, marking each changed card. */
export const ReviewCurriculumList = ({
  model,
  decisions,
  selectedKey,
  changesOnly,
  language,
  baseLanguage,
  onSelect,
}: Props) => {
  const { t } = useTranslation();
  const liveChapterNumber = useMemo(
    () =>
      new Map(
        model.chapters
          .flatMap((chapter) => (chapter.current ? [chapter.current] : []))
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((chapter, index) => [chapter.id, index + 1]),
      ),
    [model.chapters],
  );

  const { chapters, chapterMarkers, lessonMarkers } = useMemo(() => {
    const chapterMarkers = new Map<string, CurriculumReviewMarker>();
    const lessonMarkers = new Map<string, CurriculumReviewMarker>();
    const visible = changesOnly ? model.chapters.filter(hasChanges) : model.chapters;
    const chapters: Sortable<Chapter>[] = visible.map((node, chapterIndex) => {
      chapterMarkers.set(node.id, {
        kind: node.kind,
        decision: nodeDecision(node.proposalIds, decisions),
        previousTitle: node.previousTitle,
        note: null,
      });
      const lessons = (
        changesOnly
          ? node.lessons.filter((lesson) => lesson.kind !== REVIEW_CHANGE_KIND.UNCHANGED)
          : node.lessons
      ).map((lesson, lessonIndex) => {
        const movedChapterId = lesson.movedFrom?.chapterId;
        lessonMarkers.set(lesson.id, {
          kind: lesson.kind,
          decision: nodeDecision(lesson.proposalIds, decisions),
          previousTitle: lesson.previousTitle,
          note:
            movedChapterId && movedChapterId !== lesson.chapterId
              ? t("courseAuthoring.reviewMode.movedFromChapter", {
                  number: liveChapterNumber.get(movedChapterId) ?? 0,
                })
              : null,
        });
        return toLesson(lesson, lessonIndex);
      });
      return {
        ...(node.current ?? { id: node.id, isFree: false, updatedAt: "" }),
        id: node.id,
        title: node.title,
        displayOrder: chapterIndex,
        lessonCount: lessons.length,
        lessons,
        sortableId: node.id,
      } as Sortable<Chapter>;
    });
    return { chapters, chapterMarkers, lessonMarkers };
  }, [changesOnly, decisions, liveChapterNumber, model.chapters, t]);

  const [selectedType, selectedId] = selectedKey?.split(/:(.+)/) ?? [];
  const selectedChapter =
    selectedType === REVIEW_NODE_TYPE.CHAPTER
      ? (chapters.find((chapter) => chapter.id === selectedId) ?? null)
      : null;
  const selectedLesson =
    selectedType === REVIEW_NODE_TYPE.LESSON
      ? (chapters
          .flatMap((chapter) => chapter.lessons)
          .find((lesson) => lesson.id === selectedId) ?? null)
      : null;
  const openChapterId = selectedChapter?.id ?? selectedLesson?.chapterId ?? null;

  const review = useMemo(
    () => ({
      chapter: (id: string) => chapterMarkers.get(id),
      lesson: (id: string) => lessonMarkers.get(id),
      openChapterId,
    }),
    [chapterMarkers, lessonMarkers, openChapterId],
  );

  const course = model.course;
  const courseKey = course ? reviewNodeKey(course) : null;

  return (
    <div className="flex flex-col" data-testid="course-authoring-review-tree">
      {course && courseKey && (
        <Card
          role="button"
          tabIndex={0}
          data-testid="course-authoring-review-course"
          className={cn(
            "mb-4 flex cursor-pointer items-center gap-x-3 border p-4",
            reviewAccentClass(REVIEW_CHANGE_KIND.EDITED),
            selectedKey === courseKey && "border-primary-500",
          )}
          onClick={() => onSelect(courseKey)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(courseKey);
            }
          }}
        >
          <Icon name="Settings" className="ml-2 size-5 text-primary-700" />
          <span className="body-base-md flex-1 text-neutral-950">
            {t("courseAuthoring.reviewMode.courseDetails")}
          </span>
          <ReviewCardMarker
            marker={{
              kind: REVIEW_CHANGE_KIND.EDITED,
              decision: nodeDecision(course.proposalIds, decisions),
              previousTitle: null,
              note: null,
            }}
          />
        </Card>
      )}
      <ChaptersList
        chapters={chapters}
        canRefetchChapterList={false}
        setContentTypeToDisplay={noop}
        setSelectedChapter={(chapter) =>
          chapter && onSelect(reviewNodeKey({ nodeType: REVIEW_NODE_TYPE.CHAPTER, id: chapter.id }))
        }
        setSelectedLesson={noop}
        selectedChapter={selectedChapter}
        selectedLesson={selectedLesson}
        language={language}
        baseLanguage={baseLanguage}
        isCourseGenerationLocked
        isReadOnlyPreview
        onPreviewLessonSelect={(_chapter, lesson) =>
          onSelect(reviewNodeKey({ nodeType: REVIEW_NODE_TYPE.LESSON, id: lesson.id }))
        }
        isPreviewLessonReady={() => true}
        review={review}
        unregisteredUserCoursesAccessibility={false}
      />
      <div className="mt-4 flex w-full gap-3">
        <Button disabled className="w-1/2 rounded-lg px-4 py-2">
          <Icon name="Plus" className="mr-2" />
          {t("adminCourseView.curriculum.chapter.button.addChapter")}
        </Button>
        <Button disabled variant="outline" className="w-1/2 gap-2 rounded-lg px-4 py-2">
          <Icon name="WandSparkles" className="size-4" />
          {t("courseAuthoring.openWorkspace")}
        </Button>
      </div>
    </div>
  );
};
