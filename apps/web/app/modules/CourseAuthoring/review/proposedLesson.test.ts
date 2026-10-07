import { describe, expect, it } from "vitest";

import {
  AUTHORING_OPERATION_TYPE,
  REVIEW_CHANGE_KIND,
  REVIEW_NODE_TYPE,
} from "./curriculumReview.constants";
import { proposedLesson, proposedMentorConfiguration } from "./proposedLesson";

import type { ReviewLessonNode } from "./curriculumReview.types";

const mentorNode: ReviewLessonNode = {
  nodeType: REVIEW_NODE_TYPE.LESSON,
  id: "lesson-new",
  chapterId: "chapter-1",
  title: "Handle a tough customer call",
  previousTitle: null,
  lessonType: "ai_mentor",
  kind: REVIEW_CHANGE_KIND.ADDED,
  movedFrom: null,
  current: null,
  proposalIds: ["proposal-1"],
  operations: [
    {
      operationId: "operation-1",
      targetId: "lesson-new",
      type: AUTHORING_OPERATION_TYPE.LESSON_CREATE,
      dependencies: [],
      payload: {
        lessonType: "ai_mentor",
        title: "Handle a tough customer call",
        description: "<p>Calm an upset customer.</p>",
        name: "Alex",
        voiceMode: "preset",
        ttsPreset: "female",
        configurationType: "roleplay",
        configuration: {
          scenario: "A delayed delivery",
          aiRole: "Upset customer",
          learnerRole: "Support agent",
          characterGoal: "Get a clear next step",
          difficulty: "medium",
          factsAndConstraints: null,
          openingInstruction: null,
          additionalInstructions: null,
        },
        judgeConfiguration: {
          taskGoal: "De-escalate the call",
          passingThresholdPercent: 70,
          criteria: [
            {
              ref: "C1",
              title: "Empathy",
              expectedBehavior: "Acknowledges the frustration",
              maxScore: 2,
              scoreGuidance: [{ score: 2, description: "Names the feeling", example: null }],
            },
          ],
          blockingErrors: [{ ref: "B1", description: "Blames the customer" }],
        },
        sourceVersionIds: [],
        avatarAssetId: null,
        preparedResourceIds: [],
      },
    },
  ],
};

describe("proposed AI Mentor lesson", () => {
  it("fills the native form's lesson fields from the proposed payload", () => {
    expect(proposedLesson(mentorNode)).toMatchObject({
      id: "lesson-new",
      type: "ai_mentor",
      title: "Handle a tough customer call",
      description: "<p>Calm an upset customer.</p>",
      aiMentor: { name: "Alex", voiceMode: "preset", ttsPreset: "female" },
    });
  });

  it("maps the proposed Mentor and judge configuration to form drafts without references", () => {
    const { aiMentorConfiguration, aiJudgeConfiguration } = proposedMentorConfiguration(mentorNode);

    expect(aiMentorConfiguration).toMatchObject({
      type: "roleplay",
      scenario: "A delayed delivery",
      difficulty: "medium",
    });
    expect(aiJudgeConfiguration).toEqual({
      taskGoal: "De-escalate the call",
      passingThresholdPercent: 70,
      criteria: [
        {
          title: "Empathy",
          expectedBehavior: "Acknowledges the frustration",
          maxScore: 2,
          scoreGuidance: [{ score: 2, description: "Names the feeling", example: undefined }],
        },
      ],
      blockingErrors: [{ description: "Blames the customer" }],
    });
  });

  it("returns no drafts when the lesson is not a Mentor write", () => {
    expect(proposedMentorConfiguration({ ...mentorNode, operations: [] })).toEqual({});
  });
});

describe("proposed fill-in-the-blanks lesson", () => {
  it("shows the answer placements in the native read-only quiz form", () => {
    const blankId = "00000000-0000-4000-8000-000000000001";
    const questionId = "00000000-0000-4000-8000-000000000002";
    const lessonNode: ReviewLessonNode = {
      ...mentorNode,
      id: "lesson-quiz",
      lessonType: "quiz",
      operations: [
        {
          operationId: "operation-quiz",
          targetId: "lesson-quiz",
          type: AUTHORING_OPERATION_TYPE.LESSON_CREATE,
          dependencies: [],
          payload: {
            lessonType: "quiz",
            title: "Safeguards quiz",
            questions: [
              {
                id: questionId,
                questionType: "fill_in_the_blanks_dnd",
                title: "Match the concern",
                prompt: `<p>Protect <blank-answer-${blankId}></blank-answer-${blankId}> data.</p>`,
                blanks: [
                  {
                    id: blankId,
                    answerSets: [{ preferredAnswer: "customer", acceptedAnswers: ["customer"] }],
                  },
                ],
                dragAndDropOptions: [
                  {
                    id: "00000000-0000-4000-8000-000000000003",
                    label: "customer",
                    targetBlankId: blankId,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    expect(proposedLesson(lessonNode)?.questions?.[0]).toMatchObject({
      description: expect.stringContaining(`data-option-id="${blankId}"`),
      options: [{ id: blankId, optionText: "customer", isCorrect: true }],
    });
  });
});
