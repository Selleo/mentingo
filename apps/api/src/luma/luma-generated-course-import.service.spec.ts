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

  it("accepts a generated Roleplay lesson and imports its structured configuration", () => {
    const lesson = {
      aiMentor: {
        name: "Customer",
        aiMentorConfiguration: {
          type: "roleplay",
          scenario: "A customer objects to the proposed budget.",
          aiRole: "A skeptical customer",
          learnerRole: "A sales representative",
          characterGoal: "Understand the value before agreeing to a next step.",
          difficulty: "challenging",
          factsAndConstraints: "The customer has a fixed budget.",
          openingInstruction: "Stay skeptical but answer questions.",
          additionalInstructions: "Do not invent pricing details.",
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
    expect(createService()["buildImportedAiMentorConfiguration"](aiMentor.aiMentorConfiguration)).toEqual(
      {
        type: "roleplay",
        scenario: "A customer objects to the proposed budget.",
        aiRole: "A skeptical customer",
        learnerRole: "A sales representative",
        characterGoal: "Understand the value before agreeing to a next step.",
        difficulty: "challenging",
        factsAndConstraints: "The customer has a fixed budget.",
        openingInstruction: "Stay skeptical but answer questions.",
        additionalInstructions: "Do not invent pricing details.",
      },
    );
  });

  it("imports all required Teacher configuration fields", () => {
    const lesson = {
      aiMentor: {
        name: "Product Coach",
        aiMentorConfiguration: {
          type: "teacher",
          taskGoal: "Explain the product value proposition.",
          expertise: "B2B product sales",
          contentScope: "The product catalogue and customer outcomes",
          teachingStyle: "guided_discovery",
          feedbackGuidance: "Ask for evidence before correcting the learner.",
        },
        ttsPreset: "male",
        aiJudgeConfiguration: {
          taskGoal: "Explain the product value proposition",
          passingThresholdPercent: 70,
          criteria: [],
          blockingErrors: [],
        },
      },
    } as unknown as LumaGeneratedCourseLesson;

    const aiMentor = createService()["getAiMentor"](lesson);

    expect(createService()["buildImportedAiMentorConfiguration"](aiMentor.aiMentorConfiguration)).toEqual(
      {
        type: "teacher",
        taskGoal: "Explain the product value proposition.",
        expertise: "B2B product sales",
        contentScope: "The product catalogue and customer outcomes",
        teachingStyle: "guided_discovery",
        feedbackGuidance: "Ask for evidence before correcting the learner.",
        openingInstruction: undefined,
        additionalInstructions: undefined,
      },
    );
  });

  it("rejects a generated AI Mentor lesson without a valid configuration", () => {
    const lesson = {
      aiMentor: {
        name: "Customer",
        ttsPreset: "female",
      },
    } as unknown as LumaGeneratedCourseLesson;

    expect(() => createService()["getAiMentor"](lesson)).toThrow(
      new BadRequestException("luma.errors.invalidAiMentorConfiguration"),
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
