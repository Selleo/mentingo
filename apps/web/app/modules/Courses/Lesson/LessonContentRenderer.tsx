import { memo } from "react";
import { match } from "ts-pattern";

import Viewer from "~/components/RichText/Viever";

import AiMentorLesson from "./AiMentorLesson/AiMentorLesson";
import { EmbedLesson } from "./EmbedLesson/EmbedLesson";
import { Quiz } from "./Quiz";

import type { CurrentUserResponse, GetLessonByIdResponse } from "~/api/generated-api";

type LessonContentRendererProps = {
  lesson: GetLessonByIdResponse["data"];
  user: CurrentUserResponse["data"] | undefined;
  isPreviewMode: boolean;
  lessonLoading: boolean;
  onVideoEnded?: () => void;
};

export const LessonContentRenderer = memo(
  ({ lesson, user, isPreviewMode, lessonLoading, onVideoEnded }: LessonContentRendererProps) => {
    return match(lesson.type)
      .with("content", () => (
        <Viewer variant="content" content={lesson?.description ?? ""} onVideoEnded={onVideoEnded} />
      ))
      .with("quiz", () => (
        <Quiz
          lesson={lesson}
          userId={user?.id || ""}
          isPreviewMode={isPreviewMode}
          previewLessonId={lesson.id}
        />
      ))
      .with("ai_mentor", () => (
        <AiMentorLesson
          lesson={lesson}
          lessonLoading={lessonLoading}
          isPreviewMode={isPreviewMode}
        />
      ))
      .with("embed", () => (
        <EmbedLesson lessonResources={lesson.lessonResources ?? []} lesson={lesson} />
      ))
      .otherwise(() => null);
  },
);

LessonContentRenderer.displayName = "LessonContentRenderer";
