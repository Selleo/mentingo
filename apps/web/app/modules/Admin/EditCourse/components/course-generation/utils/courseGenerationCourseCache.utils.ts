import { COURSE_GENERATION_STREAM_EVENT_TYPE } from "@repo/shared";
import { flattenDeep, isPlainObject } from "lodash-es";

import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";

import type {
  CourseGenerationChapterGeneratedEvent,
  CourseGenerationLessonGeneratedEvent,
} from "@repo/shared";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

type StreamEvents = {
  chapters: Chapter[];
  lessons: Array<Lesson & { chapterId: string }>;
};

const LUMA_PREVIEW_LESSON_TYPES = {
  AI_MENTOR: "AI_MENTOR",
  CONTENT: "CONTENT",
  QUIZ: "QUIZ",
} as const;

function flatten(value: unknown): unknown[] {
  return flattenDeep(Array.isArray(value) ? value : [value]) as unknown[];
}

function toObject(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null;
}

function isPreviewChapterGeneratedEvent(
  value: unknown,
): value is CourseGenerationChapterGeneratedEvent {
  const event = toObject(value);
  const generation = toObject(event?.generation);

  return (
    event?.type === COURSE_GENERATION_STREAM_EVENT_TYPE.DESIGNER_CHAPTER_GENERATED &&
    generation !== null &&
    typeof generation.chapter_index === "number" &&
    typeof generation.title === "string" &&
    typeof generation.target_lesson_count === "number"
  );
}

function isPreviewLessonGeneratedEvent(
  value: unknown,
): value is CourseGenerationLessonGeneratedEvent {
  const event = toObject(value);
  const generation = toObject(event?.generation);

  return (
    event?.type === COURSE_GENERATION_STREAM_EVENT_TYPE.ARCHITECT_LESSON_GENERATED &&
    typeof event.chapter_index === "number" &&
    typeof event.lesson_index === "number" &&
    generation !== null &&
    typeof generation.lesson_type === "string" &&
    typeof generation.title === "string"
  );
}

function getTempId(prefix: string, index: number, title: string | null) {
  const suffix = title
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return suffix ? `luma-preview-${prefix}-${index}-${suffix}` : `luma-preview-${prefix}-${index}`;
}

function normalizeLessonType(
  value: CourseGenerationLessonGeneratedEvent["generation"]["lesson_type"],
): LessonType {
  if (value === LUMA_PREVIEW_LESSON_TYPES.AI_MENTOR) {
    return LessonType.AI_MENTOR;
  }

  if (value === LUMA_PREVIEW_LESSON_TYPES.QUIZ) {
    return LessonType.QUIZ;
  }

  return LessonType.CONTENT;
}

function mapPreviewChapter(event: CourseGenerationChapterGeneratedEvent): {
  chapter: Chapter;
  previewIndex: number;
} {
  const { generation } = event;
  const previewIndex = generation.chapter_index;
  const id = getTempId("chapter", previewIndex, generation.title);

  return {
    chapter: {
      id,
      title: generation.title,
      updatedAt: new Date(0).toISOString(),
      displayOrder: previewIndex + 1,
      isFree: false,
      lessonCount: generation.target_lesson_count,
      lessons: [],
    },
    previewIndex,
  };
}

function mapPreviewLesson(
  event: CourseGenerationLessonGeneratedEvent,
  chapterIdsByPreviewIndex: Map<number, string>,
): (Lesson & { chapterId: string }) | null {
  const { generation } = event;
  const chapterId = chapterIdsByPreviewIndex.get(event.chapter_index);

  if (!chapterId) return null;

  const type = normalizeLessonType(generation.lesson_type);
  const id = getTempId("lesson", event.lesson_index, generation.title);

  return {
    id,
    title: generation.title,
    type,
    chapterId,
    description: "",
    updatedAt: new Date(0).toISOString(),
    displayOrder: event.lesson_index + 1,
  };
}

function extractPreviewEvents(streamData: unknown): StreamEvents {
  const chapters: Chapter[] = [];
  const lessons: Array<Lesson & { chapterId: string }> = [];
  const chapterIdsByPreviewIndex = new Map<number, string>();

  for (const item of flatten(streamData)) {
    if (isPreviewChapterGeneratedEvent(item)) {
      const previewChapter = mapPreviewChapter(item);
      chapters.push(previewChapter.chapter);
      chapterIdsByPreviewIndex.set(previewChapter.previewIndex, previewChapter.chapter.id);
      continue;
    }

    if (isPreviewLessonGeneratedEvent(item)) {
      const lesson = mapPreviewLesson(item, chapterIdsByPreviewIndex);
      if (lesson) lessons.push(lesson);
    }
  }

  return { chapters, lessons };
}

function sortByDisplayOrder<T extends { displayOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getCourseGenerationPreviewChapters(streamData: unknown): Chapter[] {
  const events = extractPreviewEvents(streamData);
  const chapters = new Map<string, Chapter>();

  for (const chapter of events.chapters) {
    if (chapters.has(chapter.id)) continue;
    chapters.set(chapter.id, chapter);
  }

  for (const lesson of events.lessons) {
    const chapter = chapters.get(lesson.chapterId);
    if (!chapter) continue;
    if (chapter.lessons.some((existingLesson) => existingLesson.id === lesson.id)) continue;

    const lessons = sortByDisplayOrder([...chapter.lessons, lesson]);
    chapters.set(chapter.id, {
      ...chapter,
      lessons,
      lessonCount: lessons.length,
    });
  }

  return sortByDisplayOrder([...chapters.values()]);
}

export function hasCourseGenerationPreviewEvents(streamData: unknown): boolean {
  return flatten(streamData).some(
    (item) => isPreviewChapterGeneratedEvent(item) || isPreviewLessonGeneratedEvent(item),
  );
}
