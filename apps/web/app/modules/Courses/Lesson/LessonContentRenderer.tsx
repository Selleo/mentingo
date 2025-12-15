import { memo } from "react";
import { match } from "ts-pattern";

import Presentation from "~/components/Presentation/Presentation";
import Viewer from "~/components/RichText/Viever";
import { Video } from "~/components/VideoPlayer/Video";

import AiMentorLesson from "./AiMentorLesson/AiMentorLesson";
import { EmbedLesson } from "./EmbedLesson/EmbedLesson";
import { Quiz } from "./Quiz";

import type { CurrentUserResponse, GetLessonByIdResponse } from "~/api/generated-api";

type LessonContentRendererProps = {
  lesson: GetLessonByIdResponse["data"];
  user: CurrentUserResponse["data"] | undefined;
  isPreviewMode: boolean;
  lessonLoading: boolean;
  handleVideoEnded: () => void;
};

export const LessonContentRenderer = memo(
  ({
    lesson,
    user,
    isPreviewMode,
    lessonLoading,
    handleVideoEnded,
  }: LessonContentRendererProps) => {
    return match(lesson.type)
      .with("text", () => <Viewer variant="lesson" content={lesson?.description ?? ""} />)
      .with("quiz", () => (
        <Quiz
          lesson={lesson}
          userId={user?.id || ""}
          isPreviewMode={isPreviewMode}
          previewLessonId={lesson.id}
        />
      ))
      .with("video", () => (
        <Video
          url={lesson.fileUrl}
          isExternalUrl={lesson.isExternal}
          onVideoEnded={handleVideoEnded}
        />
      ))
      .with("presentation", () => (
        <Presentation url={lesson.fileUrl ?? ""} isExternalUrl={lesson.isExternal} />
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
