import { memo } from "react";
import { match } from "ts-pattern";

import Viewer from "~/components/RichText/Viever";

import AiMentorLesson from "./AiMentorLesson/AiMentorLesson";
import { EmbedLesson } from "./EmbedLesson/EmbedLesson";
import { Quiz } from "./Quiz";

import type { CurrentUserResponse, GetLessonByIdResponse } from "~/api/generated-api";
import type { VideoEndedHandler } from "~/components/VideoPlayer/VideoPlayer.types";
import type { LessonPreviewUser } from "~/modules/Courses/Lesson/types";

type LessonContentRendererProps = {
  lesson: GetLessonByIdResponse["data"];
  user: CurrentUserResponse["data"] | undefined;
  previewUser?: LessonPreviewUser;
  lessonLoading: boolean;
  onVideoEnded?: VideoEndedHandler;
};

export const LessonContentRenderer = memo(
  ({ lesson, user, previewUser, lessonLoading, onVideoEnded }: LessonContentRendererProps) => {
    return match(lesson.type)
      .with("content", () => (
        <Viewer variant="content" content={lesson?.description ?? ""} onVideoEnded={onVideoEnded} />
      ))
      .with("quiz", () => <Quiz lesson={lesson} userId={user?.id || ""} />)
      .with("ai_mentor", () => (
        <AiMentorLesson lesson={lesson} lessonLoading={lessonLoading} previewUser={previewUser} />
      ))
      .with("embed", () => (
        <EmbedLesson lessonResources={lesson.lessonResources ?? []} lesson={lesson} />
      ))
      .otherwise(() => null);
  },
);

LessonContentRenderer.displayName = "LessonContentRenderer";
