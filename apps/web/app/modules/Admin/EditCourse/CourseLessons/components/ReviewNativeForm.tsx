import { match } from "ts-pattern";

import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import {
  getAuthoringAssetIds,
  withAuthoringAssetPreviewUrls,
} from "~/modules/CourseAuthoring/review/authoringAssetPreview";
import {
  AUTHORING_OPERATION_TYPE,
  REVIEW_NODE_TYPE,
} from "~/modules/CourseAuthoring/review/curriculumReview.constants";
import {
  proposedLesson,
  proposedMentorConfiguration,
} from "~/modules/CourseAuthoring/review/proposedLesson";

import NewChapter from "../NewChapter/NewChapter";
import AiMentorLessonForm from "../NewLesson/AiMentorLessonForm/AiMentorLessonForm";
import ContentLessonForm from "../NewLesson/ContentLessonForm/ContentLessonForm";
import QuizLessonForm from "../NewLesson/QuizLessonForm/QuizLessonForm";

import { ReadOnlyFrame } from "./ReadOnlyFrame";

import type { SupportedLanguages } from "@repo/shared";
import type { ReactNode } from "react";
import type { Chapter } from "~/modules/Admin/EditCourse/EditCourse.types";
import type { SourceView } from "~/modules/CourseAuthoring/courseAuthoring.types";
import type { ReviewNode } from "~/modules/CourseAuthoring/review/curriculumReview.types";

type ReviewNativeFormOptions = {
  sources?: SourceView[];
  assetPreviewUrls?: Record<string, string>;
  targetedMentorOperationIds?: string[];
};

const noop = () => undefined;

const chapterShell = (id: string, title: string): Chapter => ({
  id,
  title,
  displayOrder: 0,
  isFree: false,
  lessonCount: 0,
  lessons: [],
  updatedAt: "",
});

/** Renders the course editor's own chapter or lesson form, filled with the proposed values. */
export const renderReviewNativeForm = (
  node: ReviewNode,
  language: SupportedLanguages,
  baseLanguage: SupportedLanguages,
  chapterPosition?: number,
  {
    sources = [],
    assetPreviewUrls = {},
    targetedMentorOperationIds = [],
  }: ReviewNativeFormOptions = {},
): ReactNode | null =>
  match(node)
    .with({ nodeType: REVIEW_NODE_TYPE.CHAPTER }, (chapter) => (
      <ReadOnlyFrame key={`${chapter.id}:${chapter.title}`}>
        <NewChapter
          setContentTypeToDisplay={noop}
          chapter={{
            ...(chapter.current ?? chapterShell(chapter.id, chapter.title)),
            title: chapter.title,
            ...(chapterPosition ? { displayOrder: chapterPosition } : {}),
          }}
          baseLanguageChapter={null}
          language={language}
        />
      </ReadOnlyFrame>
    ))
    .with({ nodeType: REVIEW_NODE_TYPE.LESSON }, (lessonNode) => {
      const proposed = proposedLesson(lessonNode);
      if (!proposed) return null;
      const lesson = {
        ...proposed,
        description: withAuthoringAssetPreviewUrls(proposed.description, assetPreviewUrls),
        ...(proposed.questions
          ? {
              questions: proposed.questions.map((question) => ({
                ...question,
                ...(question.description
                  ? {
                      description: withAuthoringAssetPreviewUrls(
                        question.description,
                        assetPreviewUrls,
                      ),
                    }
                  : {}),
              })),
            }
          : {}),
      };
      const chapter = chapterShell(lessonNode.chapterId, "");
      const hasMentorWrite = lessonNode.operations.some(
        (operation) =>
          operation.type === AUTHORING_OPERATION_TYPE.LESSON_CREATE ||
          operation.type === AUTHORING_OPERATION_TYPE.LESSON_UPDATE,
      );
      const mentorWrite = lessonNode.operations.find(
        (operation) =>
          operation.type === AUTHORING_OPERATION_TYPE.LESSON_CREATE ||
          operation.type === AUTHORING_OPERATION_TYPE.LESSON_UPDATE,
      );
      const sourceVersionIds = Array.isArray(mentorWrite?.payload.sourceVersionIds)
        ? mentorWrite.payload.sourceVersionIds.filter(
            (sourceVersionId): sourceVersionId is string => typeof sourceVersionId === "string",
          )
        : [];
      const hasTargetedBrief =
        mentorWrite && targetedMentorOperationIds.includes(mentorWrite.operationId);
      const sourceFiles = hasTargetedBrief
        ? [{ id: mentorWrite.operationId, name: `${lesson.title}.txt`, mediaType: "text/plain" }]
        : sourceVersionIds.flatMap((sourceVersionId) => {
            const source = sources.find((item) => item.id === sourceVersionId);
            return source
              ? [{ id: source.id, name: source.name, mediaType: source.mediaType }]
              : [];
          });
      const referencedAssetIds = getAuthoringAssetIds(
        [
          proposed.description,
          ...(proposed.questions ?? []).map((question) => question.description ?? ""),
        ].join("\n"),
      );
      const resolvedPreviewKey = referencedAssetIds
        .flatMap((assetId) => {
          const url = assetPreviewUrls[assetId];
          return url ? [`${assetId}:${url}`] : [];
        })
        .join("|");
      const formKey = `${lesson.id}:${lessonNode.kind}:${lessonNode.operations.length}:${resolvedPreviewKey}`;
      const shared = {
        setContentTypeToDisplay: noop,
        chapterToEdit: chapter,
        lessonToEdit: lesson,
        baseLanguageLesson: null,
        setSelectedLesson: noop,
        language,
      };
      return match(lesson.type)
        .with(LessonType.CONTENT, () => (
          <ReadOnlyFrame key={formKey}>
            <ContentLessonForm {...shared} readOnly />
          </ReadOnlyFrame>
        ))
        .with(LessonType.QUIZ, () => (
          <ReadOnlyFrame key={formKey}>
            <QuizLessonForm {...shared} baseLanguage={baseLanguage} readOnly />
          </ReadOnlyFrame>
        ))
        .with(LessonType.AI_MENTOR, () => (
          <ReadOnlyFrame key={formKey}>
            <AiMentorLessonForm
              {...shared}
              baseLanguage={baseLanguage}
              reviewPreview={{
                isPersisted: Boolean(lessonNode.current),
                ...(hasMentorWrite ? proposedMentorConfiguration(lessonNode) : {}),
                ...(sourceFiles.length > 0 ? { sourceFiles } : {}),
              }}
            />
          </ReadOnlyFrame>
        ))
        .otherwise(() => null);
    })
    .otherwise(() => null);
