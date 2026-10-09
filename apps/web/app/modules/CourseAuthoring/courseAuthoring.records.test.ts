import { describe, expect, it } from "vitest";

import {
  curriculumPreviewFromProposal,
  curriculumPreviewFromProposals,
  excludeAppliedProposals,
  latestCurriculumPreview,
  projectWorkspaceRecords,
  proposalDependencyClosure,
} from "./courseAuthoring.records";

import type {
  AuthoringRecord,
  CourseContext,
  PreviewView,
  ProposalView,
} from "./courseAuthoring.types";

describe("course authoring record projection", () => {
  it("opens an operation-only curriculum preview for removals", () => {
    const preview = curriculumPreviewFromProposal({
      id: "delete-preview",
      revision: 1,
      taskId: "task-delete",
      summary: "Remove a chapter",
      rationale: "",
      warnings: [],
      blockedQuality: false,
      qualityConcernsAccepted: false,
      evidenceCount: 0,
      outline: null,
      decision: "pending",
      parentProposalId: null,
      manual: false,
      protectedEdits: [],
      operations: [
        {
          operationId: "delete-chapter",
          type: "chapter.delete",
          targetId: "chapter-old",
          dependencies: [],
          payload: {},
        },
      ],
    });

    expect(preview).toMatchObject({ proposalId: "delete-preview", outline: [] });
  });
  it("derives a positioned curriculum preview from chapter and lesson operations", () => {
    const proposal: ProposalView = {
      id: "proposal-operations",
      revision: 4,
      taskId: "task-operations",
      summary: "Add the generated lesson",
      rationale: "",
      warnings: [],
      blockedQuality: false,
      qualityConcernsAccepted: false,
      evidenceCount: 0,
      outline: null,
      decision: "pending",
      parentProposalId: null,
      manual: false,
      protectedEdits: [],
      operations: [
        {
          operationId: "chapter-create",
          targetId: "chapter-generated",
          type: "chapter.create",
          displayOrder: 1,
          dependencies: [],
          payload: { title: "Generated chapter", displayOrder: 1 },
        },
        {
          operationId: "lesson-create",
          targetId: "lesson-generated",
          type: "lesson.create",
          chapterId: "chapter-generated",
          displayOrder: 0,
          dependencies: ["chapter-create"],
          payload: { title: "Generated lesson", lessonType: "content" },
        },
        {
          operationId: "lesson-existing-chapter",
          targetId: "lesson-in-context",
          type: "lesson.create",
          chapterId: "chapter-existing",
          displayOrder: 1,
          dependencies: [],
          payload: { title: "Follow-up lesson", lessonType: "quiz" },
        },
      ],
    };
    const context: CourseContext = {
      courseId: "course-1",
      language: "en",
      title: "Course",
      description: "",
      baselineHash: "course-hash",
      fieldHashes: {},
      chapters: [
        {
          id: "chapter-existing",
          title: "Existing chapter",
          displayOrder: 0,
          baselineHash: "chapter-hash",
          lessons: [],
        },
      ],
    };

    expect(curriculumPreviewFromProposal(proposal, context)).toMatchObject({
      proposalId: "proposal-operations",
      operations: proposal.operations,
      outline: [
        {
          id: "chapter-existing",
          title: "Existing chapter",
          displayOrder: 0,
          lessons: [
            {
              id: "lesson-in-context",
              title: "Follow-up lesson",
              lessonType: "quiz",
              displayOrder: 1,
            },
          ],
        },
        {
          id: "chapter-generated",
          title: "Generated chapter",
          displayOrder: 1,
          lessons: [
            {
              id: "lesson-generated",
              title: "Generated lesson",
              lessonType: "content",
              displayOrder: 0,
            },
          ],
        },
      ],
    });
  });

  it("combines only actionable request proposals into a native curriculum preview", () => {
    const createProposal = (id: string, decision: ProposalView["decision"]): ProposalView => ({
      id,
      revision: 1,
      taskId: "task-1",
      summary: id,
      rationale: "",
      warnings: [],
      blockedQuality: false,
      qualityConcernsAccepted: false,
      evidenceCount: 0,
      outline: null,
      decision,
      parentProposalId: null,
      manual: false,
      protectedEdits: [],
      operations: [
        {
          operationId: `${id}-operation`,
          targetId: `${id}-lesson`,
          type: "lesson.create",
          chapterId: "chapter-1",
          dependencies: [],
          payload: { title: id, lessonType: "content" },
        },
      ],
    });
    const context: CourseContext = {
      courseId: "course-1",
      language: "en",
      title: "Course",
      description: "",
      baselineHash: "course-hash",
      fieldHashes: {},
      chapters: [
        {
          id: "chapter-1",
          title: "Chapter",
          displayOrder: 0,
          baselineHash: "chapter-hash",
          lessons: [],
        },
      ],
    };

    const preview = curriculumPreviewFromProposals(
      [
        createProposal("pending", "pending"),
        createProposal("accepted", "accepted"),
        createProposal("applied", "applied"),
        createProposal("rejected", "rejected"),
      ],
      context,
      "request-1",
    );

    expect(preview).toMatchObject({
      proposalIds: ["pending", "accepted"],
      reviewGroupId: "request-1",
    });
    expect(preview?.outline[0].lessons.map((lesson) => lesson.title)).toEqual([
      "pending",
      "accepted",
    ]);

    const laterReview = curriculumPreviewFromProposals(
      excludeAppliedProposals(
        [createProposal("pending", "pending"), createProposal("accepted", "accepted")],
        new Set(["accepted"]),
      ),
      context,
      "request-later-review",
    );
    expect(laterReview?.proposalIds).toEqual(["pending"]);
    expect(laterReview?.outline[0].lessons.map((lesson) => lesson.title)).toEqual(["pending"]);
  });

  it("keeps an outline-only proposal available in grouped curriculum review", () => {
    const proposal: ProposalView = {
      id: "outline-proposal",
      revision: 1,
      taskId: "task-1",
      summary: "Draft outline",
      rationale: "",
      warnings: [],
      blockedQuality: false,
      qualityConcernsAccepted: false,
      evidenceCount: 0,
      outline: [{ id: "chapter-1", title: "First chapter", lessons: [] }],
      operations: [],
      decision: "pending",
      parentProposalId: null,
      manual: false,
      protectedEdits: [],
    };

    expect(curriculumPreviewFromProposals([proposal], null, "request-1")).toMatchObject({
      reviewGroupId: "request-1",
      proposalIds: ["outline-proposal"],
      outline: [{ id: "chapter-1", title: "First chapter" }],
    });
    const lessonProposal: ProposalView = {
      ...proposal,
      id: "lesson-proposal",
      outline: null,
      operations: [
        {
          operationId: "lesson-create",
          targetId: "lesson-1",
          type: "lesson.create",
          chapterId: "chapter-1",
          dependencies: [],
          payload: { title: "First lesson", lessonType: "content" },
        },
      ],
    };
    expect(
      curriculumPreviewFromProposals([proposal, lessonProposal], null, "request-with-lessons")
        ?.outline[0].lessons,
    ).toMatchObject([{ id: "lesson-1", title: "First lesson" }]);
    expect(
      curriculumPreviewFromProposals(
        [{ ...proposal, id: "empty-proposal", outline: null }],
        null,
        "request-2",
      ),
    ).toMatchObject({ reviewGroupId: "request-2", proposalIds: ["empty-proposal"] });
  });

  it("keeps the latest outline authoritative across pending, accepted, rejected, and streaming states", () => {
    const outline = [
      {
        id: "chapter-1",
        title: "Chapter one",
        lessons: [
          { id: "lesson-1", title: "Lesson one", lessonType: "content" as const, objectives: [] },
        ],
      },
    ];
    const proposal: ProposalView = {
      id: "proposal-1",
      revision: 1,
      taskId: "task-1",
      summary: "Course plan",
      rationale: "",
      warnings: [],
      blockedQuality: false,
      qualityConcernsAccepted: false,
      evidenceCount: 0,
      operations: [],
      outline,
      decision: "pending",
      parentProposalId: null,
      manual: false,
      protectedEdits: [],
    };
    const stream: PreviewView = {
      id: "preview-1",
      taskId: "task-1",
      requestId: "request-1",
      revision: 1,
      status: "running",
      title: "Course plan",
      lessonTitle: null,
      contentText: null,
      outline: [
        {
          title: "Streaming chapter",
          lessons: [{ title: "Streaming lesson", lessonType: "content" }],
        },
      ],
    };

    expect(latestCurriculumPreview([proposal], [stream])?.status).toBe("pending");
    expect(latestCurriculumPreview([{ ...proposal, decision: "accepted" }], [stream])?.status).toBe(
      "accepted",
    );
    expect(latestCurriculumPreview([{ ...proposal, decision: "rejected" }], [stream])).toBeNull();
    expect(latestCurriculumPreview([], [stream])?.status).toBe("streaming");
    expect(latestCurriculumPreview([], [{ ...stream, status: "succeeded" }])).toBeNull();
  });

  it("uses the latest durable decision and rejects malformed records", () => {
    const records: AuthoringRecord[] = [
      {
        id: "proposal-1",
        kind: "proposal",
        payload: {
          revision: 2,
          taskId: "task-1",
          summary: "Refresh the introduction",
          operations: [
            {
              operationId: "operation-1",
              targetId: "lesson-1",
              type: "lesson.block.replace",
              dependencies: [],
              payload: { html: "<p>Updated</p>" },
            },
          ],
        },
      },
      {
        id: "decision-1",
        kind: "decision",
        payload: { proposalId: "proposal-1", sequence: 4, accepted: true },
      },
      {
        id: "decision-2",
        kind: "decision",
        payload: { proposalId: "proposal-1", sequence: 3, accepted: false },
      },
      { id: "broken", kind: "proposal", payload: { revision: "two" } },
      { id: "command-1", kind: "command", payload: { action: "request.create" } },
      { id: "future", kind: "new_record_kind", payload: { secret: "not rendered" } },
    ];

    const result = projectWorkspaceRecords(records);

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      id: "proposal-1",
      decision: "accepted",
      summary: "Refresh the introduction",
    });
    expect(result.unsupportedRecordCount).toBe(1);
  });

  it("keeps session source inventory separate from attachments on later requests", () => {
    const policy = {
      sourceVersionIds: ["source-shared"],
      webEnabled: false,
      generalKnowledgeEnabled: true,
      researchDepth: "standard",
      requiredSectionIds: [],
      excludedSectionIds: [],
    };
    const result = projectWorkspaceRecords([
      {
        id: "source-shared",
        kind: "source",
        payload: {
          sourceVersionId: "source-shared",
          filename: "Guide.pdf",
          status: "ready",
          sections: [],
        },
      },
      {
        id: "selection-shared",
        kind: "source_selection",
        payload: { sequence: 1, ...policy },
      },
      {
        id: "request-first",
        kind: "request",
        payload: {
          requestId: "request-first",
          instruction: "Use the guide in the first lesson",
          createdAt: "2026-09-22T09:00:00.000Z",
          sourcePolicy: policy,
          attachedSourceVersionIds: ["source-shared"],
        },
      },
      {
        id: "request-later",
        kind: "request",
        payload: {
          requestId: "request-later",
          instruction: "Now create a quiz",
          createdAt: "2026-09-22T09:01:00.000Z",
          sourcePolicy: policy,
          attachedSourceVersionIds: [],
        },
      },
    ]);

    expect(result.requests.map((request) => request.sourceVersionIds)).toEqual([
      ["source-shared"],
      [],
    ]);
    expect(
      result.conversation.map((entry) =>
        entry.kind === "request" ? entry.value.sourceVersionIds : [],
      ),
    ).toEqual([["source-shared"], []]);
    expect(result.sourcePolicy?.sourceVersionIds).toEqual(["source-shared"]);
    expect(result.sources).toMatchObject([{ id: "source-shared", selected: true }]);
  });

  it("normalizes malformed and legacy capability question fields without iterating raw payloads", () => {
    const result = projectWorkspaceRecords([
      {
        id: "question-legacy",
        kind: "question",
        payload: {
          taskId: "task-legacy",
          revision: 1,
          question: "Which audience should this course address?",
          choices: ["Managers", null, { label: "Everyone" }],
          capability: "unknown_permission",
          reason: { unsafe: true },
        },
      },
      {
        id: "question-malformed",
        kind: "question",
        payload: {
          taskId: "task-malformed",
          revision: 2,
          prompt: "Allow search?",
          choices: { values: ["yes", "no"] },
          capability: "web_search",
        },
      },
      { id: "question-invalid", kind: "question", payload: { choices: ["Allow"] } },
    ]);

    expect(result.questions).toEqual([
      {
        id: "question-legacy",
        taskId: "task-legacy",
        requestId: null,
        revision: 1,
        prompt: "Which audience should this course address?",
        choices: ["Managers", "Everyone"],
        capability: null,
        reason: null,
        answer: null,
        answered: false,
      },
      {
        id: "question-malformed",
        taskId: "task-malformed",
        requestId: null,
        revision: 2,
        prompt: "Allow search?",
        choices: [],
        capability: "web_search",
        reason: null,
        answer: null,
        answered: false,
      },
    ]);
    expect(result.unsupportedRecordCount).toBe(1);
  });

  it("projects durable assistant records without fabricating incomplete replies", () => {
    const result = projectWorkspaceRecords([
      {
        id: "assistant-1",
        kind: "assistant",
        payload: {
          requestId: "request-1",
          taskId: "task-1",
          route: "writer",
          message: "The lesson draft is ready to review.",
          planSteps: ["Research Mentingo", "Draft the lesson"],
          partId: "assistant:task-1:route:1",
        },
      },
      {
        id: "assistant-incomplete",
        kind: "assistant",
        payload: { route: "writer" },
      },
    ]);

    expect(result.assistantMessages).toEqual([
      {
        id: "assistant-1",
        requestId: "request-1",
        taskId: "task-1",
        route: "writer",
        message: "The lesson draft is ready to review.",
        planSteps: ["Research Mentingo", "Draft the lesson"],
        partId: "assistant:task-1:route:1",
      },
    ]);
    expect(result.unsupportedRecordCount).toBe(1);
  });

  it("uses the canonical proposal identity from the payload for decisions", () => {
    const records: AuthoringRecord[] = [
      {
        id: "storage-record-1",
        kind: "proposal",
        payload: {
          id: "proposal-domain-1",
          revision: 3,
          taskId: "task-1",
          title: "Update the introduction",
          operations: [],
        },
      },
      {
        id: "decision-1",
        kind: "decision",
        payload: {
          proposalId: "proposal-domain-1",
          sequence: 1,
          accepted: true,
        },
      },
    ];

    const result = projectWorkspaceRecords(records);

    expect(result.proposals[0]).toMatchObject({
      id: "proposal-domain-1",
      decision: "accepted",
    });
  });

  it("keeps applied proposals terminal and preserves a stable application identity", () => {
    const result = projectWorkspaceRecords([
      {
        id: "proposal-1",
        kind: "proposal",
        payload: {
          revision: 1,
          taskId: "task-1",
          operations: [],
        },
      },
      {
        id: "accept-command-1",
        kind: "decision",
        payload: {
          proposalId: "proposal-1",
          revision: 1,
          sequence: 2,
          accepted: true,
          status: "accepted",
        },
      },
      {
        id: "application-command-1",
        kind: "decision",
        payload: {
          proposalId: "proposal-1",
          revision: 1,
          sequence: 3,
          accepted: true,
          status: "applied",
        },
      },
    ]);

    expect(result.proposals[0]).toMatchObject({
      decision: "applied",
      acceptedCommandId: "proposal-1",
    });
  });

  it("restores a proposal decision from its saved snapshot status", () => {
    const result = projectWorkspaceRecords([
      {
        id: "proposal-1",
        kind: "proposal",
        payload: {
          revision: 1,
          taskId: "task-1",
          status: "rejected",
          operations: [],
        },
      },
    ]);

    expect(result.proposals[0]?.decision).toBe("rejected");
  });

  it("restores a discarded proposal snapshot as a terminal decline", () => {
    const result = projectWorkspaceRecords([
      {
        id: "proposal-discarded",
        kind: "proposal",
        payload: {
          revision: 1,
          taskId: "task-1",
          status: "discarded",
          operations: [],
        },
      },
    ]);

    expect(result.proposals[0]?.decision).toBe("rejected");
  });

  it("reports missing dependencies before an atomic selected apply", () => {
    const proposals: ProposalView[] = [
      {
        id: "proposal-a",
        revision: 1,
        taskId: "task-a",
        summary: "Create chapter",
        rationale: "",
        warnings: [],
        blockedQuality: false,
        qualityConcernsAccepted: false,
        evidenceCount: 0,
        outline: null,
        decision: "accepted",
        parentProposalId: null,
        manual: false,
        protectedEdits: [],
        operations: [
          {
            operationId: "operation-a",
            targetId: "chapter-a",
            type: "chapter.create",
            dependencies: ["operation-b"],
            payload: { title: "Safety" },
          },
        ],
      },
    ];

    expect(proposalDependencyClosure(["proposal-a"], proposals)).toEqual({
      ids: ["proposal-a"],
      missingDependencies: ["operation-b"],
    });
  });

  it("restores only the latest valid source policy and maps selected sections", () => {
    const records: AuthoringRecord[] = [
      {
        id: "source-1",
        kind: "source",
        payload: {
          sourceVersionId: "source-1",
          filename: "Safety.pdf",
          status: "partial",
          sections: [
            { id: "section-1", kind: "page", sequence: 0, status: "ready", pageNumber: 1 },
            { id: "section-2", kind: "page", sequence: 1, status: "unreadable", pageNumber: 2 },
          ],
        },
      },
      {
        id: "selection-old",
        kind: "source_selection",
        payload: {
          sequence: 4,
          sourceVersionIds: [],
          webEnabled: false,
          generalKnowledgeEnabled: true,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        },
      },
      {
        id: "selection-new",
        kind: "source_selection",
        payload: {
          sequence: 8,
          sourceVersionIds: ["source-1"],
          webEnabled: true,
          generalKnowledgeEnabled: false,
          researchDepth: "deep",
          requiredSectionIds: ["section-1"],
          excludedSectionIds: ["section-2"],
        },
      },
    ];

    const result = projectWorkspaceRecords(records);

    expect(result.sourcePolicy).toMatchObject({
      sourceVersionIds: ["source-1"],
      requiredSectionIds: ["section-1"],
      excludedSectionIds: ["section-2"],
      researchDepth: "deep",
    });
    expect(result.sources[0]).toMatchObject({
      selected: true,
      status: "ready",
      readableSections: 1,
      totalSections: 2,
    });
    expect(result.sources[0].sections[0].pageNumber).toBe(1);
  });

  it("treats an older completed partial PDF with extracted text as ready", () => {
    const result = projectWorkspaceRecords([
      {
        id: "source-old",
        kind: "source",
        payload: {
          sourceVersionId: "source-old",
          filename: "Guide.pdf",
          status: "partial",
          sections: [
            { id: "page-1", kind: "page", sequence: 0, status: "partial", label: "Usable text" },
          ],
        },
      },
    ]);

    expect(result.sources[0]).toMatchObject({ status: "ready", readableSections: 1 });
  });

  it("keeps only the latest provisional preview per task and renders content as text", () => {
    const result = projectWorkspaceRecords(
      [
        {
          id: "preview-old",
          kind: "preview",
          payload: {
            provisional: true,
            taskId: "task-1",
            requestId: "request-1",
            revision: 1,
            contentHtml: "<p>Old</p>",
          },
        },
        {
          id: "preview-new",
          kind: "preview",
          payload: {
            provisional: true,
            taskId: "task-1",
            requestId: "request-1",
            revision: 2,
            lessonTitle: "Safe preview",
            contentHtml: "<img src=x onerror=alert(1)><p>Visible text</p><script>bad()</script>",
          },
        },
      ],
      [
        {
          taskId: "task-1",
          requestId: "request-1",
          status: "succeeded",
          errorCode: null,
          outputId: "output-1",
        },
      ],
    );

    expect(result.previews).toHaveLength(1);
    expect(result.previews[0]).toMatchObject({
      id: "preview-new",
      lessonTitle: "Safe preview",
      contentText: "Visible textbad()",
      status: "succeeded",
    });
    expect(result.previews[0].contentText).not.toContain("<");
  });

  it("recognizes canonical-only snapshot records without warning about saved updates", () => {
    const result = projectWorkspaceRecords([
      { id: "delta-1", kind: "assistant.delta", payload: { taskId: "task-1" } },
      { id: "plan-1", kind: "detailed_plan", payload: { taskIds: ["task-2"] } },
      { id: "model-response-1", kind: "model_response", payload: { output: "internal" } },
      { id: "source-version-1", kind: "source_version", payload: { source: {} } },
      { id: "evidence-1", kind: "web_evidence", payload: { query: "course" } },
    ]);

    expect(result.unsupportedRecordCount).toBe(0);
  });

  it("projects asset decisions separately from normal questions and keeps ready asset identity", () => {
    const records: AuthoringRecord[] = [
      {
        id: "proposal-assets",
        kind: "proposal",
        payload: {
          revision: 1,
          summary: "Add a safety diagram",
          assetRequests: [
            {
              assetId: "asset-1",
              operationId: "operation-1",
              purpose: "diagram",
              required: false,
              altText: "A safety diagram",
              source: {
                type: "generated",
                content: "A safety diagram",
                visualQuery: "safety",
              },
            },
          ],
          assetIds: ["asset-1"],
        },
      },
      {
        id: "asset-task",
        kind: "asset_task",
        payload: {
          taskId: "task-asset",
          parentTaskId: "task-parent",
          request: {
            assetId: "asset-1",
            operationId: "operation-1",
            purpose: "diagram",
            required: false,
            altText: "A safety diagram",
            source: {
              type: "generated",
              content: "A safety diagram",
              visualQuery: "safety",
            },
          },
        },
      },
      {
        id: "question-asset",
        kind: "question",
        payload: {
          taskId: "task-asset",
          revision: 4,
          question: "Approve another diagram submission?",
          action: "asset.retry_submission",
        },
      },
      {
        id: "question-asset-old",
        kind: "question",
        payload: {
          taskId: "task-asset",
          revision: 2,
          question: "Old retry question",
          action: "asset.retry_submission",
        },
      },
      {
        id: "asset-ready:1",
        kind: "asset",
        payload: { status: "ready", manifest: { assetId: "asset-1", mimeType: "image/png" } },
      },
    ];

    const result = projectWorkspaceRecords(records, [
      {
        taskId: "task-asset",
        requestId: "request-1",
        status: "waiting_author",
        errorCode: null,
        outputId: null,
      },
    ]);

    expect(result.questions).toHaveLength(0);
    expect(result.assetTasks).toMatchObject([
      {
        taskId: "task-asset",
        revision: 4,
        action: "asset.retry_submission",
        ready: true,
      },
    ]);
    expect(result.readyAssetIds).toEqual(["asset-1"]);
    expect(result.proposals[0].assetRequests?.[0].source).toMatchObject({
      type: "generated",
      content: "A safety diagram",
      visualQuery: "safety",
    });
  });

  it("projects web capability questions with their durable turn and resolved state", () => {
    const tasks = [
      {
        taskId: "task-web",
        requestId: "request-web",
        status: "waiting_author" as const,
        errorCode: null,
        outputId: null,
      },
    ];
    const pending = projectWorkspaceRecords(
      [
        {
          id: "question-web",
          kind: "question",
          payload: {
            taskId: "task-web",
            revision: 3,
            question: "Allow web search for this request?",
            capability: "web_search",
            reason: "The request needs current public sources.",
          },
        },
      ],
      tasks,
    );
    expect(pending.questions[0]).toMatchObject({
      id: "question-web",
      taskId: "task-web",
      requestId: "request-web",
      revision: 3,
      capability: "web_search",
      reason: "The request needs current public sources.",
      answered: false,
    });

    const answered = projectWorkspaceRecords(
      [
        {
          id: "question-web",
          kind: "question",
          payload: {
            taskId: "task-web",
            revision: 3,
            question: "Allow web search for this request?",
            capability: "web_search",
            answer: "deny",
          },
        },
      ],
      tasks,
    );
    expect(answered.questions[0]).toMatchObject({ answer: "deny", answered: true });
  });

  it("replays authored clarification answers from immutable task and revision records", () => {
    const result = projectWorkspaceRecords([
      {
        id: "question-answer:task-clarification:4",
        kind: "question_answer",
        payload: {
          taskId: "task-clarification",
          requestId: "request-clarification",
          revision: 4,
          answer: "The course is for first-time people managers.",
        },
      },
      {
        id: "question-clarification",
        kind: "question",
        payload: {
          taskId: "task-clarification",
          requestId: "request-clarification",
          revision: 4,
          question: "Who is the course for?",
        },
      },
      {
        id: "question-answer:task-clarification:3",
        kind: "question_answer",
        payload: {
          taskId: "task-clarification",
          requestId: "request-clarification",
          revision: 3,
          answer: "This belongs to an earlier clarification.",
        },
      },
    ]);

    expect(result.questions).toEqual([
      expect.objectContaining({
        id: "question-clarification",
        taskId: "task-clarification",
        requestId: "request-clarification",
        revision: 4,
        prompt: "Who is the course for?",
        answer: "The course is for first-time people managers.",
        answered: true,
      }),
    ]);
    expect(result.unsupportedRecordCount).toBe(0);
  });

  it("keeps a design clarification answerable when an older record retains a capability tag", () => {
    const result = projectWorkspaceRecords(
      [
        {
          id: "web-policy",
          kind: "source_selection",
          payload: { sequence: 2, webEnabled: true, sourceVersionIds: [] },
        },
        {
          id: "duration-question",
          kind: "question",
          payload: {
            taskId: "course-task",
            revision: 2,
            action: "request.clarification",
            question: "How long should the course be?",
            capability: "web_search",
            reason: "Stale permission reason",
            choices: ["About an hour", "Two hours", "Half a day"],
          },
        },
      ],
      [
        {
          taskId: "course-task",
          requestId: "course-request",
          status: "waiting_author",
          errorCode: null,
          outputId: null,
        },
      ],
    );
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      capability: null,
      answered: false,
      answer: null,
      prompt: "How long should the course be?",
      choices: ["About an hour", "Two hours", "Half a day"],
    });
  });

  it.each(["stopped", "superseded", "succeeded"] as const)(
    "does not offer an unanswered clarification after its task is %s",
    (status) => {
      const result = projectWorkspaceRecords(
        [
          {
            id: "old-question",
            kind: "question",
            payload: {
              taskId: "old-task",
              revision: 2,
              action: "request.clarification",
              question: "How long should the course be?",
              capability: "web_search",
            },
          },
        ],
        [{ taskId: "old-task", requestId: "old-request", status, errorCode: null, outputId: null }],
      );
      expect(result.questions).toEqual([]);
    },
  );

  it("reconciles web permission prompts against persisted policy and task state after reload", () => {
    const result = projectWorkspaceRecords(
      [
        {
          id: "selection-web-enabled",
          kind: "source_selection",
          payload: {
            sequence: 2,
            sourceVersionIds: [],
            webEnabled: true,
            generalKnowledgeEnabled: false,
            researchDepth: "standard",
            requiredSectionIds: [],
            excludedSectionIds: [],
          },
        },
        {
          id: "question-web-pending",
          kind: "question",
          payload: {
            taskId: "task-completed",
            revision: 3,
            question: "Allow web search for this request?",
            capability: "web_search",
          },
        },
        {
          id: "question-web-still-waiting",
          kind: "question",
          payload: {
            taskId: "task-waiting",
            revision: 4,
            question: "Allow web search for this request?",
            capability: "web_search",
          },
        },
        {
          id: "question-web-stale",
          kind: "question",
          payload: {
            taskId: "task-finished-without-grant",
            revision: 1,
            question: "Allow web search for this request?",
            capability: "web_search",
          },
        },
      ],
      [
        {
          taskId: "task-completed",
          requestId: "request-completed",
          status: "succeeded",
          errorCode: null,
          outputId: null,
        },
        {
          taskId: "task-waiting",
          requestId: "request-waiting",
          status: "waiting_author",
          errorCode: null,
          outputId: null,
        },
        {
          taskId: "task-finished-without-grant",
          requestId: "request-finished",
          status: "failed",
          errorCode: null,
          outputId: null,
        },
      ],
    );

    expect(result.questions).toMatchObject([
      {
        id: "question-web-still-waiting",
        answer: "allow",
        answered: true,
      },
    ]);
  });

  it("rejects retired web-image assets instead of rendering them", () => {
    const result = projectWorkspaceRecords([
      {
        id: "unsafe-asset-task",
        kind: "asset_task",
        payload: {
          taskId: "task-asset",
          request: {
            assetId: "asset-1",
            operationId: "operation-1",
            purpose: "lesson",
            required: true,
            altText: "Unsafe",
            source: {
              type: "web",
              url: "javascript:alert(1)",
              license: { status: "unknown" },
            },
          },
        },
      },
    ]);

    expect(result.assetTasks).toHaveLength(0);
    expect(result.unsupportedRecordCount).toBe(1);
  });

  it("projects the latest source refresh report without changing selection during mapping", () => {
    const policy = {
      sourceVersionIds: ["old-source"],
      webEnabled: false,
      generalKnowledgeEnabled: true,
      researchDepth: "standard",
      requiredSectionIds: ["old-required"],
      excludedSectionIds: [],
    };
    const suggestedSourcePolicy = {
      ...policy,
      sourceVersionIds: ["replacement-source"],
      requiredSectionIds: [],
    };
    const result = projectWorkspaceRecords([
      {
        id: "refresh-old",
        kind: "source_refresh",
        payload: {
          refreshId: "refresh-old",
          sequence: 4,
          status: "refreshed",
          oldSourceVersionId: "old-source",
          replacementSourceVersionId: "replacement-source",
          affectedTaskIds: ["task-1"],
          affectedProposalIds: ["proposal-1"],
          unmappedSectionIds: [],
          suggestedSourcePolicy,
          sourcePolicy: suggestedSourcePolicy,
        },
      },
      {
        id: "refresh-latest",
        kind: "source_refresh",
        payload: {
          refreshId: "refresh-latest",
          sequence: 8,
          status: "needs_mapping",
          oldSourceVersionId: "old-source",
          replacementSourceVersionId: "replacement-source",
          affectedTaskIds: ["task-2"],
          coverageImpacts: [
            {
              taskId: "lesson-task-2",
              lessonId: "lesson-2",
              lessonTitle: "Lesson two",
              sourceVersionIds: ["old-source"],
              requiredSectionIds: ["old-required"],
              mappedRequiredSectionIds: [],
              mappedOutlineRequiredSectionIds: [],
              mappedExcludedSectionIds: [],
              unmappedSectionIds: ["old-required"],
              updateEligible: false,
            },
          ],
          affectedProposalIds: [],
          unmappedSectionIds: ["old-required"],
          suggestedSourcePolicy,
        },
      },
      {
        id: "selection-current",
        kind: "source_selection",
        payload: { sequence: 7, ...policy },
      },
    ]);

    expect(result.sourceRefreshes[0]).toMatchObject({
      refreshId: "refresh-latest",
      status: "needs_mapping",
      oldSourceVersionId: "old-source",
      replacementSourceVersionId: "replacement-source",
      unmappedSectionIds: ["old-required"],
      sourcePolicy: null,
      coverageImpacts: [
        expect.objectContaining({
          taskId: "lesson-task-2",
          lessonTitle: "Lesson two",
          updateEligible: false,
        }),
      ],
    });
    expect(result.sourceRefreshes).toHaveLength(2);
    expect(result.sourcePolicy?.sourceVersionIds).toEqual(["old-source"]);
  });
});

it("restores request history in durable order without retaining hidden context", () => {
  const request = (id: string, createdAt: string): AuthoringRecord => ({
    id,
    kind: "request",
    payload: {
      requestId: `request-${id}`,
      instruction: `Instruction ${id}`,
      createdAt,
      context: { privateGradingData: "must not enter the view" },
    },
  });
  const result = projectWorkspaceRecords([
    request("later", "2026-09-16T12:00:00Z"),
    request("earlier", "2026-09-16T11:00:00Z"),
    request("invalid", "not a timestamp"),
  ]);
  expect(result.requests.map((entry) => entry.requestId)).toEqual([
    "request-earlier",
    "request-later",
  ]);
  expect(result.requests[0]).not.toHaveProperty("context");
  expect(result.unsupportedRecordCount).toBe(1);
});

it("resolves metadata-only previews through the existing lesson identity", () => {
  const proposal: ProposalView = {
    id: "metadata-preview",
    revision: 1,
    taskId: "metadata-task",
    summary: "Rename a lesson",
    rationale: "",
    warnings: [],
    blockedQuality: false,
    qualityConcernsAccepted: false,
    evidenceCount: 0,
    outline: null,
    decision: "pending",
    parentProposalId: null,
    manual: false,
    protectedEdits: [],
    operations: [
      {
        operationId: "metadata-1",
        type: "lesson.metadata.update",
        targetId: "lesson-existing",
        dependencies: [],
        payload: { title: "Renamed lesson" },
      },
    ],
  };
  const context: CourseContext = {
    courseId: "course-1",
    language: "en",
    title: "Course",
    description: "",
    baselineHash: "course-hash",
    fieldHashes: {},
    chapters: [
      {
        id: "chapter-existing",
        title: "Existing chapter",
        displayOrder: 0,
        baselineHash: "chapter-hash",
        lessons: [
          {
            id: "lesson-existing",
            title: "Existing lesson",
            lessonType: "quiz",
            displayOrder: 3,
            baselineHash: "lesson-hash",
          },
        ],
      },
    ],
  };
  expect(curriculumPreviewFromProposal(proposal, context)).toMatchObject({
    outline: [
      {
        id: "chapter-existing",
        lessons: [
          {
            id: "lesson-existing",
            title: "Renamed lesson",
            lessonType: "quiz",
            displayOrder: 3,
          },
        ],
      },
    ],
  });
});

it("uses committed application mappings after partial Apply without replaying settled dependencies", () => {
  const proposal: ProposalView = {
    id: "remaining-proposal",
    revision: 1,
    taskId: "task-remaining",
    summary: "Add remaining lesson",
    rationale: "",
    warnings: [],
    blockedQuality: false,
    qualityConcernsAccepted: false,
    evidenceCount: 0,
    decision: "accepted",
    parentProposalId: null,
    manual: false,
    protectedEdits: [],
    outline: [
      {
        id: "temporary-chapter",
        title: "Old draft title",
        lessons: [
          {
            id: "temporary-applied-lesson",
            title: "Already applied",
            lessonType: "content",
            objectives: [],
          },
          { id: "remaining-lesson", title: "Remaining", lessonType: "quiz", objectives: [] },
        ],
      },
    ],
    operations: [
      {
        operationId: "remaining-op",
        type: "lesson.create",
        targetId: "remaining-lesson",
        chapterId: "temporary-chapter",
        displayOrder: 1,
        dependencies: ["applied-chapter-op"],
        payload: { title: "Remaining", lessonType: "quiz" },
      },
    ],
  };
  const context: CourseContext = {
    courseId: "course-1",
    language: "en",
    title: "Course",
    description: "",
    baselineHash: "course-hash",
    fieldHashes: {},
    chapters: [
      {
        id: "native-chapter",
        title: "Current native title",
        displayOrder: 0,
        baselineHash: "chapter-hash",
        lessons: [],
      },
    ],
  };
  const preview = curriculumPreviewFromProposal(proposal, context, {
    appliedOperationIds: ["applied-chapter-op"],
    idMappings: {
      "temporary-chapter": "native-chapter",
      "temporary-applied-lesson": "native-lesson",
    },
  });
  expect(preview).toMatchObject({
    operations: [{ targetId: "remaining-lesson", chapterId: "native-chapter", dependencies: [] }],
    outline: [
      {
        id: "native-chapter",
        title: "Current native title",
        lessons: [{ id: "remaining-lesson" }],
      },
    ],
  });
  expect(preview?.outline[0].lessons).toHaveLength(1);
  expect(proposal.operations[0].dependencies).toEqual(["applied-chapter-op"]);
  expect(() =>
    curriculumPreviewFromProposal(proposal, context, { appliedOperationIds: [], idMappings: {} }),
  ).toThrow("missingDependency");
});

it("merges identical shared chapter prerequisites across independently reviewable lessons", () => {
  const sharedChapter = {
    operationId: "shared-chapter-create",
    targetId: "chapter-new",
    type: "chapter.create",
    language: "en" as const,
    dependencies: [],
    payload: { title: "New chapter", displayOrder: 0 },
  };
  const proposals: ProposalView[] = ["first", "second"].map((id, index) => ({
    id,
    revision: 1,
    taskId: `task-${id}`,
    summary: "Add lesson",
    rationale: "",
    warnings: [],
    blockedQuality: false,
    qualityConcernsAccepted: false,
    evidenceCount: 0,
    outline: null,
    decision: "pending",
    parentProposalId: null,
    manual: false,
    protectedEdits: [],
    operations: [
      { ...sharedChapter, payload: { displayOrder: 0, title: "New chapter" } },
      {
        operationId: `lesson-create-${id}`,
        targetId: `lesson-${id}`,
        chapterId: "chapter-new",
        type: "lesson.create",
        displayOrder: index,
        dependencies: [sharedChapter.operationId],
        payload: { title: `Lesson ${id}`, lessonType: "content" },
      },
    ],
  }));
  proposals[0].operations[0] = sharedChapter;

  const preview = curriculumPreviewFromProposals(proposals);
  expect(preview?.operations).toHaveLength(3);
  expect(preview?.outline).toHaveLength(1);
  expect(preview?.outline[0].lessons.map((lesson) => lesson.id)).toEqual([
    "lesson-first",
    "lesson-second",
  ]);
  expect(preview?.proposalIds).toEqual(["first", "second"]);
  expect(proposals[1].operations).toHaveLength(2);

  const conflict = structuredClone(proposals);
  conflict[1].operations[0].payload.title = "Conflicting title";
  expect(() => curriculumPreviewFromProposals(conflict)).toThrow("duplicateOperation");

  const missingDependency = structuredClone(proposals);
  missingDependency[1].operations[1].dependencies = ["unknown-operation"];
  expect(() => curriculumPreviewFromProposals(missingDependency)).toThrow("missingDependency");

  const dependencyCycle = structuredClone(proposals);
  dependencyCycle[0].operations[1].dependencies.push("lesson-create-second");
  dependencyCycle[1].operations[1].dependencies.push("lesson-create-first");
  expect(() => curriculumPreviewFromProposals(dependencyCycle)).toThrow("dependencyCycle");

  const repeatedWithinProposal = structuredClone(proposals);
  repeatedWithinProposal[0].operations.push(sharedChapter);
  expect(() => curriculumPreviewFromProposals(repeatedWithinProposal)).toThrow(
    "duplicateOperation",
  );
});
