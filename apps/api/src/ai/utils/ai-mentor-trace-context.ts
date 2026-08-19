import type { UUIDType } from "src/common";

export const AI_MENTOR_TRACE_FLOWS = {
  COURSE_LESSON: "course-lesson",
  STANDALONE_PRACTICE: "standalone-practice",
} as const;

export type AiMentorTraceFlow = (typeof AI_MENTOR_TRACE_FLOWS)[keyof typeof AI_MENTOR_TRACE_FLOWS];

export type AiMentorTraceContext = {
  sessionId: string;
  userId: UUIDType;
  flow: AiMentorTraceFlow;
  operation: "thread-setup" | "chat" | "configuration-generation" | "evaluation";
  channel: "text" | "voice" | "background";
  tenantId?: UUIDType;
  threadId?: UUIDType;
  lessonId?: UUIDType;
  aiMentorLessonId?: UUIDType;
  practiceSessionId?: UUIDType;
  voiceSessionId?: string;
  voiceTurnId?: string;
};

export function buildAiMentorTraceAttributes({
  sessionId,
  userId,
  ...metadata
}: AiMentorTraceContext) {
  return {
    sessionId,
    userId,
    metadata: Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined),
    ),
  };
}
