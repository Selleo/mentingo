import { flattenDeep, isPlainObject } from "lodash-es";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";

import type { QueryClient } from "@tanstack/react-query";
import type { GetBetaCourseByIdResponse } from "~/api/generated-api";

type Course = GetBetaCourseByIdResponse["data"];
type Chapter = Course["chapters"][number];
type Lesson = NonNullable<Chapter["lessons"]>[number] & { chapterId: string };
type CachedCourse = Course | { data: Course };

type StreamEvents = {
  chapters: Chapter[];
  lessons: Lesson[];
  invalidate: boolean;
};

type CourseEnvelope = { data: Course };

function toObject(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null;
}

function flatten(value: unknown): unknown[] {
  return flattenDeep(Array.isArray(value) ? value : [value]) as unknown[];
}

function asChapter(value: unknown): Chapter | null {
  const chapter = toObject(value);
  return chapter && typeof chapter.id === "string" ? (chapter as unknown as Chapter) : null;
}

function asLesson(value: unknown): Lesson | null {
  const lesson = toObject(value);
  if (!lesson) return null;
  if (typeof lesson.id !== "string") return null;
  if (typeof lesson.chapterId !== "string") return null;
  return lesson as unknown as Lesson;
}

function extractEvents(streamData: unknown): StreamEvents {
  const chapters: Chapter[] = [];
  const lessons: Lesson[] = [];
  let invalidate: boolean = false;

  for (const item of flatten(streamData)) {
    const entry = toObject(item);
    if (!entry) continue;

    if (entry.type === "designer.chapter.generated") {
      const chapter = asChapter(entry.chapter);
      if (chapter) chapters.push(chapter);
      continue;
    }

    if (entry.type === "architect.lesson.generated") {
      const lesson = asLesson(entry.lesson);
      if (lesson) lessons.push(lesson);
    }

    if (entry.type === "assets.generated") {
      invalidate = true;
    }
  }

  return { chapters, lessons, invalidate };
}

function sortByDisplayOrder<T extends { displayOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder);
}

function isCourseEnvelope(value: CachedCourse): value is CourseEnvelope {
  return isPlainObject((value as CourseEnvelope).data);
}

function getCourse(cachedData: unknown): Course | null {
  const root = toObject(cachedData) as CachedCourse | null;
  if (!root) return null;

  if (isCourseEnvelope(root)) {
    const nested = root.data as Course;
    return typeof nested.id === "string" ? nested : null;
  }

  return typeof (root as Course).id === "string" ? (root as Course) : null;
}

function setCourse(cachedData: unknown, nextCourse: Course): unknown {
  const root = toObject(cachedData) as CachedCourse | null;
  if (!root) return cachedData;

  if (isCourseEnvelope(root)) {
    return {
      ...root,
      data: {
        ...(root.data as Record<string, unknown>),
        ...nextCourse,
      },
    };
  }

  return {
    ...root,
    ...nextCourse,
  };
}

function applyEvents(course: Course, events: StreamEvents): Course {
  let changed = false;
  const chapters = Array.isArray(course.chapters) ? [...course.chapters] : [];

  for (const chapter of events.chapters) {
    if (chapters.some((existing) => existing.id === chapter.id)) continue;

    chapters.push({
      ...chapter,
      lessons: Array.isArray(chapter.lessons) ? chapter.lessons : [],
      lessonCount: chapter.lessonCount ?? 0,
    });
    changed = true;
  }

  const sortedChapters = sortByDisplayOrder(chapters);

  for (const lesson of events.lessons) {
    const chapterIndex = sortedChapters.findIndex((chapter) => chapter.id === lesson.chapterId);
    if (chapterIndex < 0) continue;

    const chapter = sortedChapters[chapterIndex];
    const lessons = Array.isArray(chapter.lessons) ? [...chapter.lessons] : [];
    if (lessons.some((existing) => existing.id === lesson.id)) continue;

    lessons.push(lesson);
    sortedChapters[chapterIndex] = {
      ...chapter,
      lessons: sortByDisplayOrder(lessons),
      lessonCount: lessons.length,
    };
    changed = true;
  }

  if (!changed) return course;

  return {
    ...course,
    chapters: sortedChapters,
  };
}

export function updateGeneratedCourseCacheFromStreamData(
  queryClient: QueryClient,
  courseId: string,
  streamData: unknown,
) {
  const events = extractEvents(streamData);

  if (!events.chapters.length && !events.lessons.length) {
    return { chapterEventsCount: 0, lessonEventsCount: 0, invalidate: events.invalidate };
  }

  for (const [queryKey, cachedData] of queryClient.getQueriesData({
    queryKey: [COURSE_QUERY_KEY],
  })) {
    const course = getCourse(cachedData);
    if (!course || course.id !== courseId) continue;

    queryClient.setQueryData(queryKey, setCourse(cachedData, applyEvents(course, events)));
  }

  return {
    chapterEventsCount: events.chapters.length,
    lessonEventsCount: events.lessons.length,
    invalidate: events.invalidate,
  };
}
