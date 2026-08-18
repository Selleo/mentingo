import { AI_MENTOR_TEACHING_STYLE, AI_MENTOR_TYPE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { getApplicableAiMentorGeneratedConfiguration } from "./aiMentorGeneration.mappers";

const teacherConfiguration = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Practise explaining access control.",
  expertise: "Security trainer",
  contentScope: "Access control only",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
};

describe("getApplicableAiMentorGeneratedConfiguration", () => {
  it("accepts a server-echoed draft only for the creator-selected type", () => {
    expect(
      getApplicableAiMentorGeneratedConfiguration(
        teacherConfiguration,
        AI_MENTOR_TYPE.TEACHER,
        AI_MENTOR_TYPE.TEACHER,
      ),
    ).toEqual(teacherConfiguration);
  });

  it("blocks a stale or type-changing generated result", () => {
    expect(
      getApplicableAiMentorGeneratedConfiguration(
        teacherConfiguration,
        AI_MENTOR_TYPE.TEACHER,
        AI_MENTOR_TYPE.ROLEPLAY,
      ),
    ).toBeUndefined();
  });
});
