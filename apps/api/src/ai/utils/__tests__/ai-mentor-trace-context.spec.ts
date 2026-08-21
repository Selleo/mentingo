import {
  AI_MENTOR_TRACE_FLOWS,
  buildAiMentorTraceAttributes,
} from "src/ai/utils/ai-mentor-trace-context";

describe("buildAiMentorTraceAttributes", () => {
  it("keeps the learner identity separate from tenant metadata", () => {
    expect(
      buildAiMentorTraceAttributes({
        sessionId: "practice-session-id",
        userId: "user-id",
        tenantId: "tenant-id",
        flow: AI_MENTOR_TRACE_FLOWS.STANDALONE_PRACTICE,
        operation: "chat",
        channel: "voice",
        threadId: "thread-id",
        practiceSessionId: "practice-session-id",
        voiceSessionId: "voice-session-id",
        voiceTurnId: "voice-turn-id",
      }),
    ).toEqual({
      sessionId: "practice-session-id",
      userId: "user-id",
      metadata: {
        tenantId: "tenant-id",
        flow: "standalone-practice",
        operation: "chat",
        channel: "voice",
        threadId: "thread-id",
        practiceSessionId: "practice-session-id",
        voiceSessionId: "voice-session-id",
        voiceTurnId: "voice-turn-id",
      },
    });
  });

  it("omits unavailable flow identifiers", () => {
    expect(
      buildAiMentorTraceAttributes({
        sessionId: "thread-id",
        userId: "user-id",
        flow: AI_MENTOR_TRACE_FLOWS.COURSE_LESSON,
        operation: "chat",
        channel: "text",
        practiceSessionId: undefined,
        voiceSessionId: undefined,
      }).metadata,
    ).not.toHaveProperty("practiceSessionId");
  });
});
