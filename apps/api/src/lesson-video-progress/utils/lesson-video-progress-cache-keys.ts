import type { UUIDType } from "src/common";

const LESSON_VIDEO_WATCH_SESSION_KEY_PREFIX = "lesson-video-progress:watch-session";

export const getLessonVideoWatchSessionKey = ({
  studentId,
  lessonId,
  resourceEntityId,
}: {
  studentId: UUIDType;
  lessonId: UUIDType;
  resourceEntityId: UUIDType;
}) => `${LESSON_VIDEO_WATCH_SESSION_KEY_PREFIX}:${studentId}:${lessonId}:${resourceEntityId}`;
