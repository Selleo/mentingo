import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import {
  generateAiMentorConfigurationInputSchema,
  generatedAiMentorRoleplayConfigurationFieldsSchema,
  generatedAiMentorTeacherConfigurationFieldsSchema,
  validateAiMentorConfigurationInputSchema,
} from "./ai-mentor-configuration-generation.schema";

const courseId = "4eeb7cf8-c437-4a73-867d-d58e67827eb1";
const lessonContext = { title: "Handle a price objection" };

describe("AI Mentor configuration generation schemas", () => {
  it.each([AI_MENTOR_TYPE.TEACHER, AI_MENTOR_TYPE.ROLEPLAY])(
    "accepts creator-selected %s for create",
    (configurationType) => {
      expect(
        Value.Check(generateAiMentorConfigurationInputSchema, {
          courseId,
          lessonContext,
          mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
          configurationType,
          brief: "Create a focused practice configuration.",
        }),
      ).toBe(true);
    },
  );

  it("rejects an unsupported creator-selected type", () => {
    expect(
      Value.Check(generateAiMentorConfigurationInputSchema, {
        courseId,
        lessonContext,
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
        configurationType: "mentor",
        brief: "Create a focused practice configuration.",
      }),
    ).toBe(false);
  });

  it("accepts an incomplete current unsaved draft for improve and quality check", () => {
    const currentConfiguration = {
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: "",
      teachingStyle: "",
    };

    expect(
      Value.Check(generateAiMentorConfigurationInputSchema, {
        courseId,
        lessonContext,
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
        instruction: "Complete this Teacher configuration.",
        currentConfiguration,
      }),
    ).toBe(true);
    expect(
      Value.Check(validateAiMentorConfigurationInputSchema, {
        courseId,
        lessonContext,
        configuration: currentConfiguration,
      }),
    ).toBe(true);
  });

  it("rejects mixed Teacher and Roleplay fields", () => {
    expect(
      Value.Check(validateAiMentorConfigurationInputSchema, {
        courseId,
        lessonContext,
        configuration: {
          type: AI_MENTOR_TYPE.TEACHER,
          taskGoal: "Teach discovery.",
          scenario: "A sales meeting.",
        },
      }),
    ).toBe(false);
  });

  it("keeps the model output type-less and rejects extra type fields", () => {
    const teacherFields = {
      taskGoal: "Teach discovery.",
      expertise: "Sales coaching",
      contentScope: "Discovery questions only.",
      teachingStyle: "guided_discovery",
      feedbackGuidance: null,
      openingInstruction: null,
      additionalInstructions: null,
    };
    const roleplayFields = {
      scenario: "A buyer challenges the proposal.",
      aiRole: "Buyer",
      learnerRole: "Sales representative",
      characterGoal: "Understand the proposal value.",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
      factsAndConstraints: null,
      openingInstruction: null,
      additionalInstructions: null,
    };

    expect(Value.Check(generatedAiMentorTeacherConfigurationFieldsSchema, teacherFields)).toBe(
      true,
    );
    expect(
      Value.Check(generatedAiMentorTeacherConfigurationFieldsSchema, {
        type: AI_MENTOR_TYPE.TEACHER,
        ...teacherFields,
      }),
    ).toBe(false);
    expect(Value.Check(generatedAiMentorRoleplayConfigurationFieldsSchema, roleplayFields)).toBe(
      true,
    );
    expect(
      Value.Check(generatedAiMentorRoleplayConfigurationFieldsSchema, {
        type: AI_MENTOR_TYPE.ROLEPLAY,
        ...roleplayFields,
      }),
    ).toBe(false);
  });
});
