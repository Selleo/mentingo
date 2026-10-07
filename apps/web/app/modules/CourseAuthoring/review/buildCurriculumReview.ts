import { mergeCurriculumPreview } from "~/modules/Admin/EditCourse/CourseLessons/CourseLessons.helpers";

import {
  AUTHORING_OPERATION_TYPE,
  REVIEW_CHANGE_KIND,
  REVIEW_NODE_TYPE,
} from "./curriculumReview.constants";

import type {
  CurriculumReviewModel,
  ReviewChange,
  ReviewChangeCounts,
  ReviewChapterNode,
  ReviewCourseNode,
  ReviewLessonNode,
  ReviewProposal,
} from "./curriculumReview.types";
import type { AuthoringOperation, CurriculumPreview } from "../courseAuthoring.types";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

const COURSE_OPERATION_TYPES = new Set<string>([
  AUTHORING_OPERATION_TYPE.COURSE_METADATA_UPDATE,
  AUTHORING_OPERATION_TYPE.COURSE_SETTINGS_UPDATE,
]);
const LESSON_CONTENT_OPERATION_TYPES = new Set<string>([
  AUTHORING_OPERATION_TYPE.LESSON_UPDATE,
  AUTHORING_OPERATION_TYPE.LESSON_BLOCK_REPLACE,
  AUTHORING_OPERATION_TYPE.COURSE_LESSON_UPDATE,
]);

export const emptyChangeCounts = (): ReviewChangeCounts => ({
  [REVIEW_CHANGE_KIND.ADDED]: 0,
  [REVIEW_CHANGE_KIND.EDITED]: 0,
  [REVIEW_CHANGE_KIND.REMOVED]: 0,
  [REVIEW_CHANGE_KIND.MOVED]: 0,
});

const byDisplayOrder = <T extends { displayOrder: number }>(items: T[]) =>
  [...items].sort((left, right) => left.displayOrder - right.displayOrder);

/** Keeps the longest run that stayed in relative order, so one swap flags one item. */
export const movedIds = (current: string[], next: string[]): Set<string> => {
  const currentIndex = new Map(current.map((id, index) => [id, index]));
  const shared = next.filter((id) => currentIndex.has(id));
  const sequence = shared.map((id) => currentIndex.get(id) ?? 0);
  const tails: number[] = [];
  const tailIndexes: number[] = [];
  const previous = new Array<number>(sequence.length).fill(-1);
  sequence.forEach((value, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < value) low = middle + 1;
      else high = middle;
    }
    tails[low] = value;
    tailIndexes[low] = index;
    previous[index] = low > 0 ? tailIndexes[low - 1] : -1;
  });
  const stable = new Set<string>();
  let cursor = tailIndexes[tails.length - 1] ?? -1;
  while (cursor >= 0) {
    stable.add(shared[cursor]);
    cursor = previous[cursor];
  }
  return new Set(shared.filter((id) => !stable.has(id)));
};

const unique = (values: string[]) => [...new Set(values)];

type BuildInput = {
  chapters: Chapter[];
  preview: CurriculumPreview;
  proposals?: ReviewProposal[];
  courseTitle?: string;
  courseId?: string;
};

export const buildCurriculumReview = ({
  chapters,
  preview,
  proposals = [],
  courseTitle = "",
  courseId = "course",
}: BuildInput): CurriculumReviewModel => {
  const operations = preview.operations ?? [];
  const ownerByOperationId = new Map<string, string>();
  proposals.forEach((proposal) =>
    proposal.operationIds.forEach((operationId) =>
      ownerByOperationId.set(operationId, proposal.id),
    ),
  );
  const proposalIdsFor = (items: AuthoringOperation[]) =>
    unique(
      items.flatMap((operation) => {
        const owner = ownerByOperationId.get(operation.operationId);
        return owner ? [owner] : [];
      }),
    );

  const currentChapters = byDisplayOrder(chapters).map((chapter) => ({
    ...chapter,
    lessons: byDisplayOrder(chapter.lessons),
  }));
  const currentChapterById = new Map(currentChapters.map((chapter) => [chapter.id, chapter]));
  const currentLessonById = new Map<string, { lesson: Lesson; chapterId: string; index: number }>();
  currentChapters.forEach((chapter) =>
    chapter.lessons.forEach((lesson, index) =>
      currentLessonById.set(lesson.id, { lesson, chapterId: chapter.id, index }),
    ),
  );

  const lessonChapterOverride = new Map<string, string>();
  operations.forEach((operation) => {
    if (operation.chapterId && LESSON_CONTENT_OPERATION_TYPES.has(operation.type)) {
      lessonChapterOverride.set(operation.targetId, operation.chapterId);
    }
  });
  const proposedChapters = mergeCurriculumPreview(currentChapters, preview).map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.filter((lesson) => {
      const override = lessonChapterOverride.get(lesson.id);
      return !override || override === chapter.id;
    }),
  }));
  const proposedChapterIds = new Set(proposedChapters.map((chapter) => chapter.id));
  const proposedLessonIds = new Set(
    proposedChapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
  );

  const operationsFor = (targetId: string) =>
    operations.filter((operation) => operation.targetId === targetId);
  const reorderOperation = (type: string, id: string) =>
    operations.filter(
      (operation) =>
        operation.type === type &&
        Array.isArray(operation.payload.orderedIds) &&
        operation.payload.orderedIds.includes(id),
    );

  const movedChapterIds = movedIds(
    currentChapters.map((chapter) => chapter.id).filter((id) => proposedChapterIds.has(id)),
    proposedChapters.map((chapter) => chapter.id),
  );

  const lessonNode = (lesson: Lesson, chapterId: string, movedInChapter: Set<string>) => {
    const current = currentLessonById.get(lesson.id) ?? null;
    const ownOperations = operationsFor(lesson.id);
    const changedChapter = current !== null && current.chapterId !== chapterId;
    const moved = changedChapter || movedInChapter.has(lesson.id);
    const nodeOperations = [
      ...ownOperations,
      ...(moved ? reorderOperation(AUTHORING_OPERATION_TYPE.LESSON_REORDER, lesson.id) : []),
    ];
    const titleChanged = current !== null && current.lesson.title !== lesson.title;
    const contentChanged = ownOperations.some((operation) =>
      LESSON_CONTENT_OPERATION_TYPES.has(operation.type),
    );
    let kind: ReviewLessonNode["kind"] = REVIEW_CHANGE_KIND.UNCHANGED;
    if (!current) kind = REVIEW_CHANGE_KIND.ADDED;
    else if (titleChanged || contentChanged) kind = REVIEW_CHANGE_KIND.EDITED;
    else if (moved) kind = REVIEW_CHANGE_KIND.MOVED;
    return {
      nodeType: REVIEW_NODE_TYPE.LESSON,
      id: lesson.id,
      chapterId,
      title: lesson.title,
      previousTitle: current && titleChanged ? current.lesson.title : null,
      lessonType: current?.lesson.type ?? lesson.type,
      kind,
      movedFrom:
        moved && current ? { chapterId: current.chapterId, position: current.index } : null,
      current: current?.lesson ?? null,
      operations: nodeOperations,
      proposalIds: proposalIdsFor(nodeOperations),
    } satisfies ReviewLessonNode;
  };

  const removedLessonNode = (lesson: Lesson, chapterId: string): ReviewLessonNode => {
    const nodeOperations = operationsFor(lesson.id);
    return {
      nodeType: REVIEW_NODE_TYPE.LESSON,
      id: lesson.id,
      chapterId,
      title: lesson.title,
      previousTitle: null,
      lessonType: lesson.type,
      kind: REVIEW_CHANGE_KIND.REMOVED,
      movedFrom: null,
      current: lesson,
      operations: nodeOperations,
      proposalIds: proposalIdsFor(nodeOperations),
    };
  };

  const withRemovedLessons = (lessons: ReviewLessonNode[], current: Chapter | undefined) => {
    if (!current) return lessons;
    const result = [...lessons];
    current.lessons.forEach((lesson, index) => {
      if (proposedLessonIds.has(lesson.id)) return;
      const insertAt = result.findIndex((item) => {
        const origin = currentLessonById.get(item.id);
        return origin?.chapterId === current.id && origin.index > index;
      });
      result.splice(
        insertAt < 0 ? result.length : insertAt,
        0,
        removedLessonNode(lesson, current.id),
      );
    });
    return result;
  };

  const countLessons = (lessons: ReviewLessonNode[]) => {
    const counts = emptyChangeCounts();
    lessons.forEach((lesson) => {
      if (lesson.kind !== REVIEW_CHANGE_KIND.UNCHANGED) counts[lesson.kind] += 1;
    });
    return counts;
  };

  const reviewChapters: ReviewChapterNode[] = proposedChapters.map((chapter) => {
    const current = currentChapterById.get(chapter.id);
    const movedInChapter = movedIds(
      (current?.lessons ?? []).map((lesson) => lesson.id).filter((id) => proposedLessonIds.has(id)),
      chapter.lessons.map((lesson) => lesson.id),
    );
    const lessons = withRemovedLessons(
      chapter.lessons.map((lesson) => lessonNode(lesson, chapter.id, movedInChapter)),
      current,
    );
    const moved = movedChapterIds.has(chapter.id);
    const titleChanged = current !== undefined && current.title !== chapter.title;
    const nodeOperations = [
      ...operationsFor(chapter.id),
      ...(moved ? reorderOperation(AUTHORING_OPERATION_TYPE.CHAPTER_REORDER, chapter.id) : []),
    ];
    let kind: ReviewChapterNode["kind"] = REVIEW_CHANGE_KIND.UNCHANGED;
    if (!current) kind = REVIEW_CHANGE_KIND.ADDED;
    else if (titleChanged) kind = REVIEW_CHANGE_KIND.EDITED;
    else if (moved) kind = REVIEW_CHANGE_KIND.MOVED;
    return {
      nodeType: REVIEW_NODE_TYPE.CHAPTER,
      id: chapter.id,
      title: chapter.title,
      previousTitle: current && titleChanged ? current.title : null,
      kind,
      movedFrom: moved && current ? { position: currentChapters.indexOf(current) } : null,
      current: current ?? null,
      operations: nodeOperations,
      proposalIds: proposalIdsFor(nodeOperations),
      lessons,
      changeCounts: countLessons(lessons),
    };
  });

  currentChapters.forEach((chapter, index) => {
    if (proposedChapterIds.has(chapter.id)) return;
    const lessons = chapter.lessons.map((lesson) => removedLessonNode(lesson, chapter.id));
    const nodeOperations = operationsFor(chapter.id);
    const insertAt = reviewChapters.findIndex(
      (item) => item.current !== null && currentChapters.indexOf(item.current) > index,
    );
    reviewChapters.splice(insertAt < 0 ? reviewChapters.length : insertAt, 0, {
      nodeType: REVIEW_NODE_TYPE.CHAPTER,
      id: chapter.id,
      title: chapter.title,
      previousTitle: null,
      kind: REVIEW_CHANGE_KIND.REMOVED,
      movedFrom: null,
      current: chapter,
      operations: nodeOperations,
      proposalIds: proposalIdsFor([
        ...nodeOperations,
        ...lessons.flatMap((lesson) => lesson.operations),
      ]),
      lessons,
      changeCounts: countLessons(lessons),
    });
  });

  const courseOperations = operations.filter((operation) =>
    COURSE_OPERATION_TYPES.has(operation.type),
  );
  const course: ReviewCourseNode | null =
    courseOperations.length > 0
      ? {
          nodeType: REVIEW_NODE_TYPE.COURSE,
          id: courseId,
          title: courseTitle,
          kind: REVIEW_CHANGE_KIND.EDITED,
          operations: courseOperations,
          proposalIds: proposalIdsFor(courseOperations),
        }
      : null;

  const changes: ReviewChange[] = [];
  const counts = emptyChangeCounts();
  if (course) {
    changes.push({ key: `${REVIEW_NODE_TYPE.COURSE}:${course.id}`, node: course });
    counts[REVIEW_CHANGE_KIND.EDITED] += 1;
  }
  reviewChapters.forEach((chapter) => {
    if (chapter.kind !== REVIEW_CHANGE_KIND.UNCHANGED) {
      changes.push({ key: `${REVIEW_NODE_TYPE.CHAPTER}:${chapter.id}`, node: chapter });
      counts[chapter.kind] += 1;
    }
    if (chapter.kind === REVIEW_CHANGE_KIND.REMOVED) return;
    chapter.lessons.forEach((lesson) => {
      if (lesson.kind === REVIEW_CHANGE_KIND.UNCHANGED) return;
      changes.push({ key: `${REVIEW_NODE_TYPE.LESSON}:${lesson.id}`, node: lesson });
      counts[lesson.kind] += 1;
    });
  });

  return { course, chapters: reviewChapters, changes, counts };
};

export const reviewNodeKey = (node: { nodeType: string; id: string }) =>
  `${node.nodeType}:${node.id}`;
