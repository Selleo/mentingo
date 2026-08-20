import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import {
  aiMentorConfigurationContentSchema,
  updateAiMentorConfigurationTranslationSchema,
} from "./ai-mentor-configuration.schema";

const teacherConfiguration = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Help the learner explain the policy.",
  expertise: "Compliance trainer",
  contentScope: "Use the attached policy and avoid legal advice.",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
};

const roleplayConfiguration = {
  type: AI_MENTOR_TYPE.ROLEPLAY,
  scenario: "The learner responds to a customer complaint.",
  aiRole: "An unhappy customer",
  learnerRole: "Customer support specialist",
  characterGoal: "Receive a credible resolution and next step.",
  difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
};

describe("AI Mentor configuration schemas", () => {
  it("accepts complete Teacher and Roleplay configurations", () => {
    expect(Value.Check(aiMentorConfigurationContentSchema, teacherConfiguration)).toBe(true);
    expect(Value.Check(aiMentorConfigurationContentSchema, roleplayConfiguration)).toBe(true);
  });

  it("rejects mixed and legacy Mentor configurations", () => {
    expect(
      Value.Check(aiMentorConfigurationContentSchema, {
        ...teacherConfiguration,
        difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.CHALLENGING,
      }),
    ).toBe(false);
    expect(
      Value.Check(aiMentorConfigurationContentSchema, {
        ...roleplayConfiguration,
        teachingStyle: AI_MENTOR_TEACHING_STYLE.SOCRATIC,
      }),
    ).toBe(false);
    expect(
      Value.Check(aiMentorConfigurationContentSchema, {
        ...teacherConfiguration,
        type: "mentor",
      }),
    ).toBe(false);
  });

  it("requires non-empty core fields", () => {
    expect(
      Value.Check(aiMentorConfigurationContentSchema, {
        ...teacherConfiguration,
        taskGoal: "",
      }),
    ).toBe(false);
    expect(
      Value.Check(aiMentorConfigurationContentSchema, {
        ...roleplayConfiguration,
        learnerRole: "",
      }),
    ).toBe(false);
  });

  it("accepts only text fields matching the translation subtype", () => {
    expect(
      Value.Check(updateAiMentorConfigurationTranslationSchema, {
        type: AI_MENTOR_TYPE.TEACHER,
        taskGoal: "Wyjaśnij zasady.",
        feedbackGuidance: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(updateAiMentorConfigurationTranslationSchema, {
        type: AI_MENTOR_TYPE.TEACHER,
        scenario: "Rozmowa z klientem.",
      }),
    ).toBe(false);
    expect(
      Value.Check(updateAiMentorConfigurationTranslationSchema, {
        type: AI_MENTOR_TYPE.ROLEPLAY,
      }),
    ).toBe(false);
  });
});
