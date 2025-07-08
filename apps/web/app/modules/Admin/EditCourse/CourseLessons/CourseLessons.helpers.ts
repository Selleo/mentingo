import { match } from "ts-pattern";

import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

export const mapItemType = (itemType: string | undefined): string =>
  match(itemType)
    .with("text", () => "Text")
    .with("video", () => "Video")
    .with("presentation", () => "Presentation")
    .with("question", () => "Quiz")
    .with("ai", () => "AiMentor")
    .otherwise(() => "Quiz");

export const mapTypeToIcon = (itemType: string): string =>
  match(itemType)
    .with("text", () => "Text")
    .with("video", () => "Video")
    .with("presentation", () => "Presentation")
    .with("question", () => "Quiz")
    .with("ai", () => "AiMentor")
    .otherwise(() => "Quiz");

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
