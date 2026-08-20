import { BadRequestException } from "@nestjs/common";

import { LumaGeneratedCourseImportService } from "src/luma/luma-generated-course-import.service";

import type { LumaGeneratedCourseLesson } from "src/luma/luma.types";

describe("LumaGeneratedCourseImportService", () => {
  const createService = () =>
    new LumaGeneratedCourseImportService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

  it("accepts a generated AI Mentor lesson with a structured Judge configuration", () => {
    const lesson = {
      aiMentor: {
        name: "Customer",
        aiMentorInstructions: "Act as a customer with a budget objection.",
        taskDescription: "Handle the objection and agree a next step.",
        type: "ROLEPLAY",
        ttsPreset: "female",
        aiJudgeConfiguration: {
          taskGoal: "Handle the objection and agree a next step",
          passingThresholdPercent: 70,
          criteria: [
            {
              title: "Discovery",
              expectedBehavior: "Asks a relevant discovery question",
              maxScore: 1,
              scoreGuidance: [
                {
                  score: 0,
                  description: "Does not ask a relevant question",
                  example: "Can we move on?",
                },
                {
                  score: 1,
                  description: "Asks a relevant question",
                  example: "Which part of the timeline concerns you most?",
                },
              ],
            },
          ],
          blockingErrors: [{ description: "Invents an unsupported guarantee" }],
        },
      },
    } as unknown as LumaGeneratedCourseLesson;

    const aiMentor = createService()["getAiMentor"](lesson);

    expect(aiMentor.aiJudgeConfiguration.taskGoal).toBe(
      "Handle the objection and agree a next step",
    );
  });

  it("rejects a generated AI Mentor lesson without a valid Judge configuration", () => {
    const lesson = {
      aiMentor: {
        name: "Customer",
        aiMentorInstructions: "Act as a customer.",
        taskDescription: "Practice the conversation.",
        type: "ROLEPLAY",
        ttsPreset: "female",
      },
    } as unknown as LumaGeneratedCourseLesson;

    expect(() => createService()["getAiMentor"](lesson)).toThrow(
      new BadRequestException("luma.errors.invalidAiJudgeConfiguration"),
    );
  });
});
