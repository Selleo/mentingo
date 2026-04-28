import {
  resolveStoredAiMentorPassed,
  shouldEmitAiMentorLessonPassedEvent,
} from "../ai-mentor-pass-event.utils";

describe("AI mentor pass event helpers", () => {
  it("emits only when progress first transitions to passed", () => {
    expect(shouldEmitAiMentorLessonPassedEvent(undefined, true)).toBe(true);
    expect(shouldEmitAiMentorLessonPassedEvent(null, true)).toBe(true);
    expect(shouldEmitAiMentorLessonPassedEvent(false, true)).toBe(true);
    expect(shouldEmitAiMentorLessonPassedEvent(true, true)).toBe(false);
    expect(shouldEmitAiMentorLessonPassedEvent(false, false)).toBe(false);
  });

  it("keeps an AI mentor lesson passed once it has been passed", () => {
    expect(resolveStoredAiMentorPassed(true, false)).toBe(true);
    expect(resolveStoredAiMentorPassed(true, true)).toBe(true);
    expect(resolveStoredAiMentorPassed(false, true)).toBe(true);
    expect(resolveStoredAiMentorPassed(undefined, false)).toBe(false);
  });
});
