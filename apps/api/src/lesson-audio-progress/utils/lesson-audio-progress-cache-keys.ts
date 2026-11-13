import { courseLearningContext } from "src/course-repetition/course-learning-context";

import type { LessonAudioIdentity } from "../lesson-audio-progress.types";

const LESSON_AUDIO_LISTEN_SESSION_KEY_PREFIX = "lesson-audio-progress:listen-session";

export const getLessonAudioListenSessionKey = ({
  studentId,
  lessonId,
  resourceEntityId,
}: LessonAudioIdentity) => {
  const learningStateId = courseLearningContext.getStore()?.learningStateId;
  const learningStateSuffix = learningStateId ? `:${learningStateId}` : "";

  return `${LESSON_AUDIO_LISTEN_SESSION_KEY_PREFIX}:${studentId}:${lessonId}:${resourceEntityId}${learningStateSuffix}`;
};
