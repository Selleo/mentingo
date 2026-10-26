/**
 * Builds the hierarchical learning-content result list from already authorized, hydrated rows.
 *
 * Every matching lesson is nested under its course, even when the course did not match itself,
 * so a lesson is never shown without the course that gives it meaning. Groups are ordered by their
 * best score (own or descendant), which keeps one relevance order across content types. This module
 * only regroups rows; it never widens access, because each lesson row was already filtered by an
 * access check that implies access to its course.
 */
import { GLOBAL_SEARCH_RESULT_TYPES } from "@repo/shared";

import type { SearchResultTreeInput } from "./global-search.types";
import type {
  GlobalSearchCourseResultNode,
  GlobalSearchLessonResultNode,
  GlobalSearchResultNode,
} from "./schemas/global-search.schema";

export const GLOBAL_SEARCH_LESSONS_PER_COURSE = 3;

type Evidence = {
  relevanceScore?: number;
  matchedPassage?: string;
  matchedAttachmentFileName?: string | null;
};

const evidenceOf = ({ relevanceScore, matchedPassage, matchedAttachmentFileName }: Evidence) => ({
  ...(relevanceScore === undefined ? {} : { relevanceScore }),
  ...(matchedPassage === undefined ? {} : { matchedPassage }),
  ...(matchedAttachmentFileName === undefined ? {} : { matchedAttachmentFileName }),
});

/** Higher scores first; unscored nodes keep their input order after scored ones. */
const byScore = <T extends { relevanceScore?: number }>(nodes: T[]) =>
  nodes
    .map((node, index) => ({ node, index }))
    .sort((left, right) => {
      const leftScore = left.node.relevanceScore;
      const rightScore = right.node.relevanceScore;
      if (leftScore === rightScore) return left.index - right.index;
      if (leftScore === undefined) return 1;
      if (rightScore === undefined) return -1;
      return rightScore - leftScore;
    })
    .map(({ node }) => node);

const maxScore = (left?: number, right?: number) => {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
};

export const buildSearchResultTree = ({
  courseLists,
  lessons,
  learningPaths,
  news,
  articles,
  qa,
}: SearchResultTreeInput): GlobalSearchResultNode[] => {
  const courseNodes = new Map<string, GlobalSearchCourseResultNode>();
  const lessonsByCourse = new Map<string, GlobalSearchLessonResultNode[]>();

  for (const course of courseLists.flat()) {
    if (courseNodes.has(course.id)) continue;
    courseNodes.set(course.id, {
      ...evidenceOf(course),
      type: GLOBAL_SEARCH_RESULT_TYPES.COURSE,
      id: course.id,
      title: course.title,
      category: course.category,
      thumbnailUrl: course.thumbnailUrl,
      courseChapterCount: course.courseChapterCount,
      completedChapterCount: course.completedChapterCount,
      matched: true,
      lessons: [],
      hiddenLessonCount: 0,
    });
  }

  for (const lesson of lessons) {
    const parent = courseNodes.get(lesson.courseId);
    if (!parent) {
      courseNodes.set(lesson.courseId, {
        type: GLOBAL_SEARCH_RESULT_TYPES.COURSE,
        id: lesson.courseId,
        title: lesson.courseTitle ?? "",
        ...(lesson.courseCategory ? { category: lesson.courseCategory } : {}),
        thumbnailUrl: lesson.courseThumbnailUrl ?? null,
        matched: false,
        lessons: [],
        hiddenLessonCount: 0,
      });
    }
    const siblings = lessonsByCourse.get(lesson.courseId) ?? [];
    siblings.push({
      ...evidenceOf(lesson),
      type: GLOBAL_SEARCH_RESULT_TYPES.LESSON,
      id: lesson.id,
      title: lesson.title,
      courseId: lesson.courseId,
      ...(lesson.chapterTitle ? { chapterTitle: lesson.chapterTitle } : {}),
    });
    lessonsByCourse.set(lesson.courseId, siblings);
  }

  for (const [courseId, courseLessons] of lessonsByCourse) {
    const course = courseNodes.get(courseId);
    if (!course) continue;
    const ranked = byScore(courseLessons);
    course.lessons = ranked;
    // A strong lesson match lifts its course group, keeping one relevance order overall.
    const groupScore = ranked.reduce<number | undefined>(
      (best, lesson) => maxScore(best, lesson.relevanceScore),
      course.relevanceScore,
    );
    if (groupScore !== undefined) course.relevanceScore = groupScore;
  }

  return byScore<GlobalSearchResultNode>([
    ...courseNodes.values(),
    ...learningPaths.map((learningPath) => ({
      ...evidenceOf(learningPath),
      type: GLOBAL_SEARCH_RESULT_TYPES.LEARNING_PATH,
      id: learningPath.id,
      title: learningPath.title,
      thumbnailUrl: learningPath.thumbnailReference ?? null,
      courseCount: learningPath.courses.length,
    })),
    ...news.map((item) => ({
      ...evidenceOf(item),
      type: GLOBAL_SEARCH_RESULT_TYPES.NEWS,
      id: item.id,
      title: item.title,
    })),
    ...articles.map((item) => ({
      ...evidenceOf(item),
      type: GLOBAL_SEARCH_RESULT_TYPES.ARTICLE,
      id: item.id,
      title: item.title,
    })),
    ...qa.map((item) => ({
      ...evidenceOf(item),
      type: GLOBAL_SEARCH_RESULT_TYPES.QA,
      id: item.id,
      title: item.title,
    })),
  ]);
};

/**
 * Keep course groups short for compact clients such as the search dialog. Lessons beyond the
 * limit are counted in `hiddenLessonCount`; ordering and group scores are unchanged.
 */
export const limitLessonsPerCourse = (
  nodes: GlobalSearchResultNode[],
  limit = GLOBAL_SEARCH_LESSONS_PER_COURSE,
): GlobalSearchResultNode[] =>
  nodes.map((node) =>
    node.type === GLOBAL_SEARCH_RESULT_TYPES.COURSE && node.lessons.length > limit
      ? {
          ...node,
          lessons: node.lessons.slice(0, limit),
          hiddenLessonCount: node.hiddenLessonCount + node.lessons.length - limit,
        }
      : node,
  );
