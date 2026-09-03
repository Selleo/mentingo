import { BadRequestException } from "@nestjs/common";

import { CourseDurationRefreshRequestedEvent } from "src/events";
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
      undefined as never,
    );

  it("accepts a generated AI Mentor lesson with a structured Judge configuration", () => {
    const lesson = {
      aiMentor: {
        name: "Customer",
        taskDescription: "Practice handling a customer's budget objection.",
        aiMentorConfiguration: {
          type: "roleplay",
          scenario: "A customer raises a budget objection.",
          aiRole: "Customer",
          learnerRole: "Sales representative",
          characterGoal: "Reach a practical next step.",
          difficulty: "realistic",
          additionalInstructions: "Act as a customer with a budget objection.",
        },
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
    expect(aiMentor.taskDescription).toBe("Practice handling a customer's budget objection.");

    expect(createService()["buildImportedAiMentorConfiguration"](aiMentor)).toMatchObject({
      type: "roleplay",
      scenario: "A customer raises a budget objection.",
      aiRole: "Customer",
      learnerRole: "Sales representative",
      characterGoal: "Reach a practical next step.",
      difficulty: "realistic",
      additionalInstructions: "Act as a customer with a budget objection.",
    });
  });

  it("rejects a generated AI Mentor lesson without a valid Judge configuration", () => {
    const lesson = {
      aiMentor: {
        name: "Customer",
        aiMentorConfiguration: {
          type: "roleplay",
          scenario: "Practice the conversation.",
          aiRole: "Customer",
          learnerRole: "Sales representative",
          characterGoal: "Reach a practical next step.",
          difficulty: "realistic",
        },
        ttsPreset: "female",
      },
    } as unknown as LumaGeneratedCourseLesson;

    expect(() => createService()["getAiMentor"](lesson)).toThrow(
      new BadRequestException("luma.errors.invalidAiJudgeConfiguration"),
    );
  });

  it("publishes a course duration refresh event after the import transaction commits", async () => {
    let committed = false;
    const transaction = jest.fn(async (callback: (trx: never) => Promise<void>) => {
      await callback({} as never);
      committed = true;
    });
    const publish = jest.fn(async () => {
      expect(committed).toBe(true);
    });
    const service = new LumaGeneratedCourseImportService(
      { transaction } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { markProcessed: jest.fn().mockResolvedValue({}) } as never,
      { publish } as never,
    );
    const serviceInternals = service as unknown as Record<string, jest.Mock>;
    serviceInternals.getCourseBaseLanguage = jest.fn().mockResolvedValue("en");
    serviceInternals.assertCourseHasNoChapters = jest.fn().mockResolvedValue(undefined);
    serviceInternals.sortChapters = jest.fn().mockReturnValue([]);
    serviceInternals.updateCourseChapterCount = jest.fn().mockResolvedValue(undefined);
    serviceInternals.flushPendingAiMentorContextIngestions = jest.fn().mockResolvedValue(undefined);

    const courseId = "course-id" as never;
    await service.importBundle(courseId, { assets: [], course: {} } as never, undefined as never);

    expect(publish).toHaveBeenCalledWith(new CourseDurationRefreshRequestedEvent({ courseId }));
  });
});
