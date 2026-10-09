import { orderCourseAuthoringOperations, planCourseAuthoringOrder } from "@repo/shared";
import { match } from "ts-pattern";

import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import type { Chapter, Lesson } from "../EditCourse.types";
import type { CurriculumPreview } from "~/modules/CourseAuthoring/courseAuthoring.types";

export const mapTypeToIcon = (itemType: string): string =>
  match(itemType)
    .with("content", () => "Content")
    .with("quiz", () => "Quiz")
    .with("ai_mentor", () => "AiMentor")
    .with("embed", () => "Embed")
    .otherwise(() => "Content");

export const mapQuestionTypeToLabel = (questionType: QuestionType): string =>
  match(questionType)
    .with(QuestionType.SINGLE_CHOICE, () => "adminCourseView.curriculum.lesson.other.singleChoice")
    .with(
      QuestionType.MULTIPLE_CHOICE,
      () => "adminCourseView.curriculum.lesson.other.multipleChoice",
    )
    .with(QuestionType.TRUE_OR_FALSE, () => "adminCourseView.curriculum.lesson.other.trueOrFalse")
    .with(
      QuestionType.BRIEF_RESPONSE,
      () => "adminCourseView.curriculum.lesson.other.briefResponse",
    )
    .with(
      QuestionType.DETAILED_RESPONSE,
      () => "adminCourseView.curriculum.lesson.other.detailedResponse",
    )
    .with(
      QuestionType.PHOTO_QUESTION_SINGLE_CHOICE,
      QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE,
      () => "adminCourseView.curriculum.lesson.other.photoQuestion",
    )
    .with(
      QuestionType.FILL_IN_THE_BLANKS_TEXT,
      () => "adminCourseView.curriculum.lesson.other.fillInTheBlanksText",
    )
    .with(
      QuestionType.FILL_IN_THE_BLANKS_DND,
      () => "adminCourseView.curriculum.lesson.other.fillInTheBlanks",
    )
    .with(QuestionType.MATCH_WORDS, () => "adminCourseView.curriculum.lesson.other.matchWords")
    .with(QuestionType.SCALE_1_5, () => "adminCourseView.curriculum.lesson.other.scale1_5")
    .otherwise(() => "");

/** Converts a durable authoring outline into the row shape used by ChaptersList. */
export const curriculumPreviewToChapters = (preview: CurriculumPreview): Chapter[] =>
  preview.outline.map((chapter, chapterIndex) => ({
    id: chapter.id,
    title: chapter.title,
    updatedAt: "1970-01-01T00:00:00.000Z",
    displayOrder: chapter.displayOrder ?? chapterIndex,
    isFree: false,
    lessonCount: chapter.lessons.length,
    lessons: chapter.lessons.map((lesson, lessonIndex) => ({
      id: lesson.id,
      updatedAt: "1970-01-01T00:00:00.000Z",
      type: ["content", "quiz", "ai_mentor"].includes(lesson.lessonType)
        ? (lesson.lessonType as Lesson["type"])
        : "content",
      displayOrder: lesson.displayOrder ?? lessonIndex,
      title: lesson.title,
      description: "",
      chapterId: chapter.id,
    })),
  }));

/** Merges draft rows into the current curriculum without changing canonical query data. */
export const mergeCurriculumPreview = (
  chapters: Chapter[],
  preview: CurriculumPreview | null,
): Chapter[] => {
  if (!preview) return chapters;

  const draftChapters = curriculumPreviewToChapters(preview);
  const merged = [...chapters]
    .sort(
      (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
    )
    .map((chapter) => ({
      ...chapter,
      lessons: [...chapter.lessons]
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
        )
        .map((lesson) => ({ ...lesson })),
    }));

  if (!preview.operations?.length)
    draftChapters.forEach((draftChapter) => {
      let parent = merged.find((chapter) => chapter.id === draftChapter.id);
      if (!parent) {
        parent = { ...draftChapter, lessons: [] };
        merged.push(parent);
      } else {
        parent.title = draftChapter.title;
      }
      for (const draftLesson of draftChapter.lessons) {
        const existing = merged
          .flatMap((chapter) => chapter.lessons)
          .find((lesson) => lesson.id === draftLesson.id);
        if (existing) {
          existing.title = draftLesson.title;
        } else {
          parent.lessons.push(draftLesson);
        }
      }
    });

  const operations = orderCourseAuthoringOperations(preview.operations ?? []);
  for (const operation of operations) {
    if (operation.type === "chapter.delete") {
      const index = merged.findIndex((chapter) => chapter.id === operation.targetId);
      if (index >= 0) merged.splice(index, 1);
      continue;
    }
    if (operation.type === "lesson.delete") {
      for (const chapter of merged)
        chapter.lessons = chapter.lessons.filter((lesson) => lesson.id !== operation.targetId);
      continue;
    }
    if (operation.type === "chapter.update" || operation.type === "chapter.create") {
      let chapter = merged.find((item) => item.id === operation.targetId);
      if (
        !chapter &&
        operation.type === "chapter.create" &&
        typeof operation.payload.title === "string"
      ) {
        chapter = {
          id: operation.targetId,
          title: operation.payload.title,
          updatedAt: "1970-01-01T00:00:00.000Z",
          displayOrder: merged.length,
          isFree: false,
          lessonCount: 0,
          lessons: [],
        };
        merged.push(chapter);
      }
      if (chapter && typeof operation.payload.title === "string")
        chapter.title = operation.payload.title;
      continue;
    }
    if (
      operation.type === "lesson.metadata.update" ||
      operation.type === "lesson.update" ||
      operation.type === "lesson.create"
    ) {
      let lesson = merged
        .flatMap((chapter) => chapter.lessons)
        .find((item) => item.id === operation.targetId);
      if (
        !lesson &&
        operation.type === "lesson.create" &&
        typeof operation.payload.title === "string"
      ) {
        const chapter = merged.find((item) => item.id === operation.chapterId);
        if (!chapter) continue;
        lesson = {
          id: operation.targetId,
          updatedAt: "1970-01-01T00:00:00.000Z",
          type: ["content", "quiz", "ai_mentor"].includes(String(operation.payload.lessonType))
            ? (operation.payload.lessonType as Lesson["type"])
            : "content",
          displayOrder: chapter.lessons.length,
          title: operation.payload.title,
          description: "",
          chapterId: chapter.id,
        };
        chapter.lessons.push(lesson);
      }
      if (!lesson) continue;
      if (typeof operation.payload.title === "string") lesson.title = operation.payload.title;
      if (typeof operation.payload.description === "string")
        lesson.description = operation.payload.description;
    }
  }

  const orderingOperations = operations.length
    ? operations
    : preview.outline
        .flatMap((chapter, chapterIndex) => [
          {
            operationId: `preview-chapter:${chapter.id}`,
            dependencies: [],
            type: "chapter.update",
            targetId: chapter.id,
            payload: { displayOrder: chapter.displayOrder ?? chapterIndex },
          },
          ...chapter.lessons.map((lesson, lessonIndex) => ({
            operationId: `preview-lesson:${lesson.id}`,
            dependencies: [],
            type: "lesson.update",
            targetId: lesson.id,
            chapterId: chapter.id,
            displayOrder: lesson.displayOrder ?? lessonIndex,
            payload: {},
          })),
        ])
        .filter((operation) => {
          if (operation.type === "chapter.update") {
            const outlined = preview.outline.find((chapter) => chapter.id === operation.targetId);
            return (
              outlined?.displayOrder !== undefined ||
              !chapters.some((chapter) => chapter.id === operation.targetId)
            );
          }
          const outlined = preview.outline
            .flatMap((chapter) => chapter.lessons)
            .find((lesson) => lesson.id === operation.targetId);
          return (
            outlined?.displayOrder !== undefined ||
            !chapters.some((chapter) =>
              chapter.lessons.some((lesson) => lesson.id === operation.targetId),
            )
          );
        });
  const orderGroups = planCourseAuthoringOrder(
    [
      { kind: "chapter", orderedIds: merged.map((chapter) => chapter.id) },
      ...merged.map((chapter) => ({
        kind: "lesson" as const,
        chapterId: chapter.id,
        orderedIds: chapter.lessons.map((lesson) => lesson.id),
      })),
    ],
    orderingOperations,
  );
  for (const group of orderGroups) {
    const positions = new Map(group.orderedIds.map((id, index) => [id, index]));
    if (group.kind === "chapter") {
      merged.sort(
        (left, right) =>
          (positions.get(left.id) ?? Infinity) - (positions.get(right.id) ?? Infinity),
      );
    } else {
      const chapter = merged.find((item) => item.id === group.chapterId);
      chapter?.lessons.sort(
        (left, right) =>
          (positions.get(left.id) ?? Infinity) - (positions.get(right.id) ?? Infinity),
      );
    }
  }

  return merged.map((chapter, index) => ({
    ...chapter,
    lessonCount: chapter.lessons.length,
    displayOrder: index + 1,
    lessons: chapter.lessons.map((lesson, lessonIndex) => ({
      ...lesson,
      displayOrder: lessonIndex + 1,
    })),
  }));
};
