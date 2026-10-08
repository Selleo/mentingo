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
  const merged = chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) => ({ ...lesson })),
  }));

  draftChapters.forEach((draftChapter, chapterIndex) => {
    const existingChapterIndex = merged.findIndex(({ id }) => id === draftChapter.id);
    if (existingChapterIndex < 0) {
      merged.splice(
        Math.min(draftChapter.displayOrder ?? chapterIndex, merged.length),
        0,
        draftChapter,
      );
      return;
    }

    const existingChapter = merged[existingChapterIndex];
    const mergedLessons = existingChapter.lessons.map((lesson) => ({ ...lesson }));
    draftChapter.lessons.forEach((draftLesson, lessonIndex) => {
      const existingLesson = existingChapter.lessons.find(({ id }) => id === draftLesson.id);
      const currentLessonIndex = mergedLessons.findIndex(({ id }) => id === draftLesson.id);
      if (existingLesson && currentLessonIndex >= 0) {
        mergedLessons[currentLessonIndex] = { ...existingLesson, ...draftLesson };
        return;
      }
      mergedLessons.splice(
        Math.min(draftLesson.displayOrder ?? lessonIndex, mergedLessons.length),
        0,
        draftLesson,
      );
    });
    merged[existingChapterIndex] = {
      ...existingChapter,
      title: draftChapter.title,
      lessonCount: mergedLessons.length,
      lessons: mergedLessons,
    };
  });

  // An operation-only proposal may have no outline. Project removals and
  // ordering onto the native rows so its preview still opens in the curriculum.
  preview.operations?.forEach((operation) => {
    if (operation.type === "chapter.delete") {
      const index = merged.findIndex((chapter) => chapter.id === operation.targetId);
      if (index >= 0) merged.splice(index, 1);
      return;
    }
    if (operation.type === "lesson.delete") {
      merged.forEach((chapter) => {
        chapter.lessons = chapter.lessons.filter((lesson) => lesson.id !== operation.targetId);
        chapter.lessonCount = chapter.lessons.length;
      });
      return;
    }
    if (operation.type === "chapter.reorder" || operation.type === "lesson.reorder") {
      const orderedIds = operation.payload.orderedIds;
      if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string")) return;
      const position = new Map(orderedIds.map((id, index) => [id, index]));
      if (operation.type === "chapter.reorder") {
        merged.sort(
          (left, right) =>
            (position.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (position.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        );
      } else {
        const chapter = merged.find((item) => item.id === operation.chapterId);
        chapter?.lessons.sort(
          (left, right) =>
            (position.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (position.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        );
      }
      return;
    }
    if (operation.type === "chapter.update") {
      const chapter = merged.find((item) => item.id === operation.targetId);
      if (chapter && typeof operation.payload.title === "string")
        chapter.title = operation.payload.title;
      return;
    }
    if (operation.type === "lesson.metadata.update") {
      const lesson = merged
        .flatMap((chapter) => chapter.lessons)
        .find((item) => item.id === operation.targetId);
      if (!lesson) return;
      if (typeof operation.payload.title === "string") lesson.title = operation.payload.title;
      if (typeof operation.payload.description === "string")
        lesson.description = operation.payload.description;
      return;
    }
    if (operation.type === "lesson.create" || operation.type === "lesson.update") {
      const chapter = merged.find((item) => item.id === operation.chapterId);
      if (!chapter) return;
      const lesson = chapter.lessons.find((item) => item.id === operation.targetId);
      if (lesson) {
        if (typeof operation.payload.title === "string") lesson.title = operation.payload.title;
        if (typeof operation.payload.description === "string")
          lesson.description = operation.payload.description;
      } else if (
        operation.type === "lesson.create" &&
        typeof operation.payload.title === "string"
      ) {
        chapter.lessons.splice(
          Math.min(operation.displayOrder ?? chapter.lessons.length, chapter.lessons.length),
          0,
          {
            id: operation.targetId,
            updatedAt: "1970-01-01T00:00:00.000Z",
            type: ["content", "quiz", "ai_mentor"].includes(String(operation.payload.lessonType))
              ? (operation.payload.lessonType as Lesson["type"])
              : "content",
            displayOrder: operation.displayOrder ?? chapter.lessons.length,
            title: operation.payload.title,
            description:
              typeof operation.payload.description === "string"
                ? operation.payload.description
                : "",
            chapterId: chapter.id,
          },
        );
        chapter.lessonCount = chapter.lessons.length;
      }
    }
  });

  return merged.map((chapter, index) => ({
    ...chapter,
    displayOrder: index + 1,
    lessons: chapter.lessons.map((lesson, lessonIndex) => ({
      ...lesson,
      displayOrder: lessonIndex + 1,
    })),
  }));
};
