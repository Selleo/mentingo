import {
  AI_MENTOR_CONFIGURATION_FIELD,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";

import {
  attachAiMentorRoleplayConfiguration,
  attachAiMentorTeacherConfiguration,
  getDeterministicAiMentorConfigurationValidation,
} from "./ai-mentor-configuration-draft";

describe("AI Mentor configuration draft helpers", () => {
  it("attaches the server-owned Teacher type to type-less fields", () => {
    expect(
      attachAiMentorTeacherConfiguration({
        taskGoal: "Teach discovery.",
        expertise: "Sales coaching",
        contentScope: "Discovery questions only.",
        teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
        feedbackGuidance: null,
        openingInstruction: null,
        additionalInstructions: null,
      }),
    ).toEqual({
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: "Teach discovery.",
      expertise: "Sales coaching",
      contentScope: "Discovery questions only.",
      teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
      feedbackGuidance: null,
      openingInstruction: null,
      additionalInstructions: null,
    });
  });

  it("attaches the server-owned Roleplay type to type-less fields", () => {
    expect(
      attachAiMentorRoleplayConfiguration({
        scenario: "A buyer challenges the proposal.",
        aiRole: "Buyer",
        learnerRole: "Sales representative",
        characterGoal: "Understand the proposal value.",
        difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
        factsAndConstraints: null,
        openingInstruction: null,
        additionalInstructions: null,
      }).type,
    ).toBe(AI_MENTOR_TYPE.ROLEPLAY);
  });

  it("returns deterministic field findings without targeting type", () => {
    const result = getDeterministicAiMentorConfigurationValidation({
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: "",
      expertise: "Sales coaching",
      contentScope: "",
      teachingStyle: "unsupported",
    });

    expect(result?.passed).toBe(false);
    expect(result?.issues.map(({ target }) => target.field)).toEqual([
      AI_MENTOR_CONFIGURATION_FIELD.TASK_GOAL,
      AI_MENTOR_CONFIGURATION_FIELD.CONTENT_SCOPE,
      AI_MENTOR_CONFIGURATION_FIELD.TEACHING_STYLE,
    ]);
    expect(result?.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ target: { field: "type" } })]),
    );
  });
});
