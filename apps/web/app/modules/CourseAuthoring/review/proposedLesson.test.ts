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

describe("metadata-only lesson preview", () => {
  it.each(["quiz", "ai_mentor", "content"] as const)(
    "preserves the existing %s lesson while clearing its description",
    (type) => {
      const current = {
        id: "lesson-existing",
        title: "Existing title",
        type,
        description: "Existing description",
        displayOrder: 4,
        updatedAt: "2026-01-01T00:00:00.000Z",
        chapterId: "chapter-1",
        thresholdScore: 70,
        questions: [],
      };
      const node: ReviewLessonNode = {
        ...mentorNode,
        id: current.id,
        title: "New title",
        current,
        operations: [
          {
            operationId: "metadata-1",
            targetId: current.id,
            type: AUTHORING_OPERATION_TYPE.LESSON_METADATA_UPDATE,
            dependencies: [],
            payload: { title: "New title", description: "" },
          },
        ],
      };
      expect(proposedLesson(node)).toEqual({ ...current, title: "New title", description: "" });
      expect(proposedMentorConfiguration(node)).toEqual({});
    },
  );
});

it("combines ordered metadata patches with a block edit in the preview", () => {
  const current = {
    id: "lesson-existing",
    title: "Existing title",
    type: "content" as const,
    description: '<p data-authoring-block-id="block-1">Before</p>',
    displayOrder: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    chapterId: "chapter-1",
  };
  const node: ReviewLessonNode = {
    ...mentorNode,
    id: current.id,
    title: "Renamed",
    current,
    operations: [
      {
        operationId: "metadata-1",
        targetId: current.id,
        type: AUTHORING_OPERATION_TYPE.LESSON_METADATA_UPDATE,
        dependencies: [],
        payload: { title: "First rename" },
      },
      {
        operationId: "block-edit",
        targetId: current.id,
        type: AUTHORING_OPERATION_TYPE.LESSON_BLOCK_REPLACE,
        dependencies: [],
        payload: {
          blockId: "block-1",
          html: '<p data-authoring-block-id="block-1">After</p>',
        },
      },
      {
        operationId: "metadata-2",
        targetId: current.id,
        type: AUTHORING_OPERATION_TYPE.LESSON_METADATA_UPDATE,
        dependencies: [],
        payload: { title: "Renamed" },
      },
    ],
  };
  expect(proposedLesson(node)).toMatchObject({
    title: "Renamed",
    description: current.description.replace("Before", "After"),
  });
});

describe("lesson preview operation ordering", () => {
  const current = {
    id: "lesson-existing",
    title: "Retention",
    type: "content" as const,
    description: '<p data-authoring-block-id="block-1">30 days</p>',
    displayOrder: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    chapterId: "chapter-1",
  };
  const metadata = {
    operationId: "metadata",
    targetId: current.id,
    type: AUTHORING_OPERATION_TYPE.LESSON_METADATA_UPDATE,
    dependencies: ["external-chapter-operation"],
    payload: { description: current.description.replace("30", "60") },
  };
  const block = {
    operationId: "block",
    targetId: current.id,
    type: AUTHORING_OPERATION_TYPE.LESSON_BLOCK_REPLACE,
    dependencies: [metadata.operationId],
    payload: { blockId: "block-1", html: current.description.replace("30", "90") },
  };
  const node = (operations: ReviewLessonNode["operations"]): ReviewLessonNode => ({
    ...mentorNode,
    id: current.id,
    title: current.title,
    lessonType: current.type,
    current,
    operations,
  });

  it.each([false, true])(
    "applies the dependent block after the new description (reversed: %s)",
    (reversed) => {
      const operations = reversed ? [block, metadata] : [metadata, block];
      expect(proposedLesson(node(operations))?.description).toBe(block.payload.html);
      expect(current.description).toContain("30 days");
    },
  );

  it("lets a later description overwrite an earlier block patch", () => {
    expect(
      proposedLesson(
        node([
          { ...metadata, dependencies: [block.operationId] },
          { ...block, dependencies: [] },
        ]),
      )?.description,
    ).toBe(metadata.payload.description);
  });

  it("uses the final full write and preserves an explicitly cleared description", () => {
    const first = {
      operationId: "first-write",
      targetId: current.id,
      type: AUTHORING_OPERATION_TYPE.LESSON_UPDATE,
      dependencies: [],
      payload: { lessonType: "content", title: "First", description: "First body" },
    };
    const last = {
      ...first,
      operationId: "last-write",
      dependencies: [first.operationId],
      payload: { lessonType: "content", title: "Last", description: "" },
    };
    expect(proposedLesson(node([last, first]))).toMatchObject({ title: "Last", description: "" });
  });
});

it("uses the final dependent Mentor write for the lesson and its configuration", () => {
  const first = mentorNode.operations[0];
  const last = {
    ...first,
    operationId: "last-mentor-write",
    dependencies: [first.operationId],
    payload: {
      ...first.payload,
      name: "Updated mentor",
      configuration: { scenario: "Updated scenario" },
    },
  };
  const node = { ...mentorNode, operations: [last, first] };
  expect(proposedLesson(node)?.aiMentor?.name).toBe("Updated mentor");
  expect(proposedMentorConfiguration(node).aiMentorConfiguration).toMatchObject({
    scenario: "Updated scenario",
  });
});
