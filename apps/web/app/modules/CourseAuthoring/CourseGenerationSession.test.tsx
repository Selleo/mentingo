import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseGenerationSession } from "./CourseGenerationSession";

import type { AuthoringChatMessage } from "./authoringChatTransport";

const state = vi.hoisted(() => ({
  accepted: false,
  outlineOnly: false,
  groupedReview: false,
  additionalRequestProposals: 0,
  malformedProposal: false,
  sourceSelectionFails: false,
  firstApplicationApplied: false,
  completeNextApplication: false,
  applyCalls: [] as Array<Record<string, unknown>>,
  commandCalls: [] as Array<Record<string, unknown>>,
  sourceRecords: [] as Array<{ id: string; kind: "source"; payload: Record<string, unknown> }>,
  progressRecords: [] as Array<{ id: string; kind: string; payload: Record<string, unknown> }>,
  sourceSelection: null as Record<string, unknown> | null,
  refetchCalls: 0,
  refetchFails: false,
  contextRefetchCalls: 0,
  contextRefetchFails: false,
  applicationResult: null as {
    exportId: string;
    status: "applied" | "failed" | "queued";
    reason?: string;
  } | null,
  applicationQueryCalls: [] as Array<string | null>,
  toastCalls: [] as Array<Record<string, unknown>>,
  chatMessages: [] as AuthoringChatMessage[],
  renderWork: false,
}));

vi.mock("./hooks/useCourseAuthoringSession", () => ({
  useCourseAuthoringSession: () => {
    const records = [
      {
        id: "content-proposal",
        kind: "proposal",
        payload: {
          id: "content-proposal",
          ...(state.groupedReview ? { taskId: "task-1" } : {}),
          revision: 1,
          summary: "Add the content lesson",
          outline: state.outlineOnly
            ? [{ id: "chapter-1", title: "Chapter 1", lessons: [] }]
            : null,
          operations: state.outlineOnly
            ? []
            : [
                {
                  operationId: "lesson-operation",
                  targetId: "lesson-target",
                  type: "lesson.create",
                  dependencies: [],
                  payload: {
                    lessonType: "content",
                    title: "Smoke lesson",
                    description: "<p>Ready</p>",
                  },
                },
              ],
        },
      },
      ...Array.from({ length: state.additionalRequestProposals }, (_, index) => ({
        id: `lesson-proposal-${index}`,
        kind: "proposal",
        payload: {
          id: `lesson-proposal-${index}`,
          taskId: `lesson-task-${index}`,
          revision: 1,
          summary: `Add lesson ${index}`,
          operations: [
            {
              operationId: `lesson-operation-${index}`,
              targetId: `lesson-target-${index}`,
              type: "lesson.create",
              dependencies: [],
              payload: { lessonType: "content", title: `Lesson ${index}` },
            },
          ],
        },
      })),
      ...(state.accepted
        ? [
            {
              id: "accepted-content-proposal",
              kind: "decision",
              payload: { proposalId: "content-proposal", sequence: 2, accepted: true },
            },
          ]
        : []),
      ...(state.firstApplicationApplied
        ? [
            {
              id: "applied-content-proposal",
              kind: "decision",
              payload: {
                proposalId: "content-proposal",
                sequence: 3,
                accepted: true,
                status: "applied",
              },
            },
            {
              id: "next-content-proposal",
              kind: "proposal",
              payload: {
                id: "next-content-proposal",
                revision: 1,
                summary: "Add the next content lesson",
                operations: [
                  {
                    operationId: "next-lesson-operation",
                    targetId: "next-lesson-target",
                    type: "lesson.create",
                    dependencies: [],
                    payload: { lessonType: "content", title: "Next lesson" },
                  },
                ],
              },
            },
            {
              id: "accepted-next-content-proposal",
              kind: "decision",
              payload: { proposalId: "next-content-proposal", sequence: 4, accepted: true },
            },
          ]
        : []),
      ...(state.malformedProposal
        ? [{ id: "broken-proposal", kind: "proposal", payload: { id: "broken-proposal" } }]
        : []),
      ...state.sourceRecords,
      ...state.progressRecords,
      ...(state.sourceSelection
        ? [{ id: "source-selection", kind: "source_selection", payload: state.sourceSelection }]
        : []),
    ];
    return {
      sessionQuery: {
        data: {
          schemaVersion: 1,
          sessionId: "session",
          courseId: "course",
          language: "en",
          status: "active",
          snapshotSequence: state.accepted ? 2 : 1,
          workspaceRevision: state.accepted ? 2 : 1,
          records,
          tasks: state.groupedReview
            ? [
                {
                  taskId: "task-1",
                  requestId: "request-1",
                  kind: "edit",
                  status: "succeeded",
                  errorCode: null,
                  outputId: "content-proposal",
                },
                ...Array.from({ length: state.additionalRequestProposals }, (_, index) => ({
                  taskId: `lesson-task-${index}`,
                  requestId: "request-1",
                  kind: "lesson",
                  status: "succeeded",
                  errorCode: null,
                  outputId: `lesson-proposal-${index}`,
                })),
              ]
            : [],
        },
        isError: false,
      },
      contextQuery: {
        data: { courseId: "course", title: "Smoke course", chapters: [] },
        refetch: async () => {
          state.contextRefetchCalls += 1;
          if (state.contextRefetchFails) throw new Error("context refresh failed");
          return { isError: false };
        },
      },
      commandMutation: {
        isPending: false,
        mutate: (command: Record<string, unknown>) => state.commandCalls.push(command),
        mutateAsync: async (command: Record<string, unknown>) => {
          state.commandCalls.push(command);
          if (command.action === "sources.select" && state.sourceSelectionFails) {
            throw new Error("source selection failed");
          }
          state.accepted = true;
          return { commandId: command.commandId, acceptedSequence: 2, workspaceRevision: 2 };
        },
      },
      refetchSnapshot: async () => {
        state.refetchCalls += 1;
        if (state.refetchFails) throw new Error("snapshot refresh failed");
      },
    };
  },
}));

vi.mock("~/api/mutations/useApplyCourseAuthoringProposals", () => ({
  useApplyCourseAuthoringProposals: (options: {
    onPreparing?: () => void;
    onSuccess?: (result: { exportId: string; status: "applied" }) => Promise<void>;
  }) => ({
    isPending: false,
    mutate: (input: Record<string, unknown>) => {
      state.applyCalls.push(input);
      options.onPreparing?.();
      if (!state.completeNextApplication) return;
      state.completeNextApplication = false;
      state.firstApplicationApplied = true;
      void options.onSuccess?.({ exportId: "export-1", status: "applied" });
    },
    mutateAsync: async (input: Record<string, unknown>) => {
      state.applyCalls.push(input);
      options.onPreparing?.();
      if (state.completeNextApplication) {
        state.completeNextApplication = false;
        state.firstApplicationApplied = true;
        await options.onSuccess?.({ exportId: "export-1", status: "applied" });
      }
      return { exportId: "export-1", status: "queued" };
    },
  }),
}));
vi.mock("~/api/mutations/useUploadCourseAuthoringSource", () => ({
  useUploadCourseAuthoringSource: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("~/api/queries/useCourseAuthoringApplicationQuery", () => ({
  useCourseAuthoringApplicationQuery: (
    _courseId: string,
    _sessionId: string,
    exportId: string | null,
  ) => {
    state.applicationQueryCalls.push(exportId);
    return { data: state.applicationResult };
  },
}));
vi.mock("~/api/queries/useCourseAuthoringTurnHistoryQuery", () => ({
  useCourseAuthoringTurnHistoryQuery: () => ({
    data: undefined,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock("./hooks/useCourseAuthoringSocket", () => ({ useCourseAuthoringSocket: () => "live" }));
vi.mock("./hooks/useCourseAuthoringChat", () => ({
  useCourseAuthoringChat: () => ({
    messages: state.chatMessages,
    error: null,
    retryLatestRequest: vi.fn(),
    sendRequest: vi.fn(),
    stop: vi.fn(),
  }),
}));
vi.mock("~/api/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
}));
vi.mock("~/components/ui/use-toast", () => ({
  useToast: () => ({ toast: (input: Record<string, unknown>) => state.toastCalls.push(input) }),
}));
vi.mock("./components/CourseGenerationInteraction", () => ({
  CourseGenerationInteraction: ({
    composer,
    review,
    history,
  }: {
    composer: React.ReactNode;
    review: React.ReactNode;
    history: React.ReactNode;
  }) => (
    <>
      {composer}
      {review}
      {history}
    </>
  ),
}));
vi.mock("./components/AuthoringAssistantMessages", () => ({
  AuthoringAssistantMessages: ({
    onAnswerQuestion,
    proposalGroups,
    taskActivities,
  }: {
    onAnswerQuestion: (question: Record<string, unknown>, answer: string) => Promise<void>;
    proposalGroups?: Array<{ content: React.ReactNode }>;
    taskActivities?: Array<{ content: React.ReactNode; sequence?: number; taskId: string }>;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          void onAnswerQuestion(
            {
              id: "web-question",
              taskId: "web-task",
              requestId: "web-request",
              revision: 1,
              capability: "web_search",
            },
            "allow",
          )
        }
      >
        Allow web question
      </button>
      {proposalGroups?.map((group) => group.content)}
      {state.renderWork &&
        taskActivities?.map((activity) => (
          <div
            key={activity.taskId}
            data-testid={activity.taskId}
            data-sequence={activity.sequence}
          >
            {activity.content}
          </div>
        ))}
    </>
  ),
}));
vi.mock("./components/ProposalGroupCard", () => ({
  ProposalGroup: ({ busy, onReview }: { busy: boolean; onReview: () => void }) => (
    <button type="button" disabled={busy} onClick={onReview}>
      Review grouped changes
    </button>
  ),
}));

vi.mock("./components/ProposalReview", () => ({
  ProposalReview: ({
    proposals,
    onAccept,
    applicationStatusByProposalId,
  }: {
    proposals: Array<unknown>;
    onAccept: (proposal: unknown) => void;
    applicationStatusByProposalId?: Record<string, string>;
  }) => (
    <>
      <button type="button" onClick={() => onAccept(proposals[0])}>
        Accept content proposal
      </button>
      <span data-testid="application-status">
        {applicationStatusByProposalId?.["content-proposal"] ?? "pending"}
      </span>
    </>
  ),
}));

describe("CourseGenerationSession proposal decisions", () => {
  beforeEach(() => {
    state.accepted = false;
    state.outlineOnly = false;
    state.groupedReview = false;
    state.additionalRequestProposals = 0;
    state.malformedProposal = false;
    state.sourceSelectionFails = false;
    state.firstApplicationApplied = false;
    state.completeNextApplication = false;
    state.applyCalls = [];
    state.commandCalls = [];
    state.sourceRecords = [];
    state.progressRecords = [];
    state.sourceSelection = null;
    state.refetchCalls = 0;
    state.refetchFails = false;
    state.contextRefetchCalls = 0;
    state.contextRefetchFails = false;
    state.applicationResult = null;
    state.applicationQueryCalls = [];
    state.toastCalls = [];
    state.chatMessages = [];
    state.renderWork = false;
    window.sessionStorage.clear();
  });

  it("shows a request's web research and generation tasks in one live work group", async () => {
    const user = userEvent.setup();
    state.groupedReview = true;
    state.additionalRequestProposals = 2;
    state.renderWork = true;
    state.chatMessages = [
      {
        id: "research-message",
        role: "assistant",
        metadata: { requestId: "request-1" },
        parts: [
          {
            type: "data-authoringPart",
            data: {
              requestId: "request-1",
              messageId: "research-message",
              taskId: "research-task",
              partId: "research-part",
              partKind: "tool",
              status: "completed",
              firstSequence: 2,
              updatedSequence: 5,
              text: null,
              tool: {
                toolCallId: "web-search-1",
                toolName: "web_search",
                display: "Search the web",
                status: "completed",
                result: null,
              },
              artifact: null,
            },
          },
        ],
      },
    ];

    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    expect(screen.getAllByText("Live work")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /Live work/ }));
    const research = screen.getByTestId("course-authoring-tool-web-search-1");
    const firstLesson = screen.getByText("Add lesson 0");
    expect(
      research.compareDocumentPosition(firstLesson) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Add lesson 1")).toBeInTheDocument();
  });

  it("restores chapter grouping from durable lesson metadata in the snapshot", async () => {
    const user = userEvent.setup();
    state.groupedReview = true;
    state.additionalRequestProposals = 2;
    state.renderWork = true;
    state.progressRecords = [0, 1].map((index) => ({
      id: `queued-lesson-${index}`,
      kind: "task.queued",
      payload: {
        sequence: index + 3,
        taskId: `lesson-task-${index}`,
        requestId: "request-1",
        workProgress: {
          stage: "lesson_generation",
          chapterId: "chapter-1",
          chapterTitle: "Getting started",
          lessonTitle: `Lesson ${index}`,
        },
      },
    }));

    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );
    await user.click(screen.getByRole("button", { name: /Live work/ }));
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 lessons complete")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 lessons complete in this chapter")).toBeInTheDocument();
  });

  it("places lesson work immediately after the outline, before later lesson proposals", () => {
    state.groupedReview = true;
    state.outlineOnly = true;
    state.additionalRequestProposals = 1;
    state.renderWork = true;
    state.chatMessages = [
      {
        id: "proposal-message",
        role: "assistant",
        metadata: { requestId: "request-1" },
        parts: [
          ...[
            { taskId: "task-1", partId: "outline-part", firstSequence: 5 },
            { taskId: "lesson-task-0", partId: "lesson-part", firstSequence: 10 },
          ].map(({ taskId, partId, firstSequence }) => ({
            type: "data-authoringPart" as const,
            data: {
              requestId: "request-1",
              messageId: "proposal-message",
              taskId,
              partId,
              partKind: "proposal" as const,
              status: "completed" as const,
              firstSequence,
              updatedSequence: firstSequence,
              text: null,
              tool: null,
              artifact: null,
            },
          })),
        ],
      },
    ];

    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    expect(screen.getByTestId("request-request-1-lessons")).toHaveAttribute("data-sequence", "5.5");
  });

  it("resumes the durable application status cursor after a reload", () => {
    window.sessionStorage.setItem(
      "course-authoring-application:course:session",
      JSON.stringify({ exportId: "pending-export", proposalIds: ["content-proposal"] }),
    );

    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    expect(state.applicationQueryCalls).toContain("pending-export");
  });

  it("refreshes the snapshot for malformed display records without showing a refresh banner", async () => {
    state.malformedProposal = true;
    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    await waitFor(() => expect(state.refetchCalls).toBe(1));
    expect(screen.queryByText(/Some saved updates cannot be displayed/)).not.toBeInTheDocument();
  });

  it("retains a confirmed Core receipt while the authoring projection still says pending", async () => {
    window.sessionStorage.setItem(
      "course-authoring-application:course:session",
      JSON.stringify({ exportId: "export-1", proposalIds: ["content-proposal"] }),
    );
    state.applicationResult = { exportId: "export-1", status: "applied" };
    const rendered = renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("application-status")).toHaveTextContent("applied"),
    );
    expect(
      JSON.parse(
        window.sessionStorage.getItem("course-authoring-application:course:session") ?? "null",
      ),
    ).toMatchObject({
      confirmed: true,
      proposalIds: ["content-proposal"],
    });

    rendered.unmount();
    state.applicationResult = null;
    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );
    expect(screen.getByTestId("application-status")).toHaveTextContent("applied");
  });

  it("applies a content proposal after its individual review decision", async () => {
    const user = userEvent.setup();
    const rendered = renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    await user.click(screen.getByRole("button", { name: "Accept content proposal" }));
    expect(state.commandCalls).toHaveLength(1);
    expect(state.commandCalls[0]).toMatchObject({
      action: "proposal.accept",
      targetId: "content-proposal",
    });
    await waitFor(() => expect(state.applyCalls).toHaveLength(1));
    expect(state.applyCalls[0]).toMatchObject({ proposalIds: ["content-proposal"] });

    rendered.rerender(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );
    await waitFor(() => expect(state.applyCalls).toHaveLength(1));
    expect(rendered).toBeTruthy();
  });

  it("accepts an outline for continued generation without native course application", async () => {
    state.outlineOnly = true;
    const user = userEvent.setup();
    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    await user.click(screen.getByRole("button", { name: "Accept content proposal" }));

    expect(state.commandCalls).toHaveLength(1);
    expect(state.commandCalls[0]).toMatchObject({
      action: "proposal.accept",
      targetId: "content-proposal",
    });
    expect(state.applyCalls).toHaveLength(0);
  });

  it("opens later grouped review after an earlier application reaches applied", async () => {
    state.groupedReview = true;
    state.applicationResult = { exportId: "earlier-export", status: "applied" };
    const onPreviewProposalInCurriculum = vi.fn();
    const user = userEvent.setup();
    renderWith().render(
      <CourseGenerationSession
        courseId="course"
        language="en"
        sessionId="session"
        embedded
        onPreviewProposalInCurriculum={onPreviewProposalInCurriculum}
      />,
    );

    const reviewButton = await screen.findByRole("button", { name: "Review grouped changes" });
    expect(reviewButton).toBeEnabled();
    await user.click(reviewButton);
    expect(onPreviewProposalInCurriculum).toHaveBeenCalledWith(
      expect.objectContaining({ proposalIds: ["content-proposal"] }),
      expect.objectContaining({
        applyReview: expect.any(Function),
        refineBatch: expect.any(Function),
      }),
    );
  });

  it("shows one review entry for every proposal produced by the same turn", async () => {
    state.groupedReview = true;
    state.additionalRequestProposals = 6;
    const onPreviewProposalInCurriculum = vi.fn();
    const user = userEvent.setup();
    renderWith().render(
      <CourseGenerationSession
        courseId="course"
        language="en"
        sessionId="session"
        embedded
        onPreviewProposalInCurriculum={onPreviewProposalInCurriculum}
      />,
    );

    const reviewButtons = await screen.findAllByRole("button", {
      name: "Review grouped changes",
    });
    expect(reviewButtons).toHaveLength(1);
    await user.click(reviewButtons[0]);
    expect(onPreviewProposalInCurriculum).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalIds: [
          "content-proposal",
          ...Array.from({ length: 6 }, (_, index) => `lesson-proposal-${index}`),
        ],
      }),
      expect.any(Object),
    );
  });

  it("submits staged proposal feedback in one batch command with revision fencing", async () => {
    state.groupedReview = true;
    state.applicationResult = { exportId: "earlier-export", status: "applied" };
    const onPreviewProposalInCurriculum = vi.fn();
    const user = userEvent.setup();
    renderWith().render(
      <CourseGenerationSession
        courseId="course"
        language="en"
        sessionId="session"
        embedded
        onPreviewProposalInCurriculum={onPreviewProposalInCurriculum}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Review grouped changes" }));
    const actions = onPreviewProposalInCurriculum.mock.calls[0]?.[1] as {
      refineBatch: (feedbacks: Array<{ proposalId: string; feedback: string }>) => Promise<void>;
    };
    await actions.refineBatch([
      { proposalId: "content-proposal", feedback: "Keep the practical example" },
    ]);

    expect(state.commandCalls).toHaveLength(1);
    expect(state.commandCalls[0]).toMatchObject({
      action: "proposal.regenerate.batch",
      regenerations: [
        {
          targetId: "content-proposal",
          expectedRevision: 1,
          feedback: "Keep the practical example",
        },
      ],
    });
  });

  it("withdraws an approved outline with request discard instead of silently skipping it", async () => {
    state.groupedReview = true;
    state.outlineOnly = true;
    state.accepted = true;
    const onPreviewProposalInCurriculum = vi.fn();
    renderWith().render(
      <CourseGenerationSession
        courseId="course"
        language="en"
        sessionId="session"
        embedded
        onPreviewProposalInCurriculum={onPreviewProposalInCurriculum}
      />,
    );
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Review grouped changes" }));
    const actions = onPreviewProposalInCurriculum.mock.calls[0]?.[1] as {
      applyReview: (review: {
        acceptedProposalIds: string[];
        rejectedProposalIds: string[];
      }) => Promise<void>;
    };
    await actions.applyReview({
      acceptedProposalIds: [],
      rejectedProposalIds: ["content-proposal"],
    });
    expect(state.commandCalls).toHaveLength(1);
    expect(state.commandCalls[0]).toMatchObject({
      action: "request.discard",
      targetId: "request-1",
    });
    expect(state.applyCalls).toHaveLength(0);
  });

  it("answers a web permission request before saving the preference with a fresh policy", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    await user.click(screen.getByRole("button", { name: "Allow web question" }));

    await waitFor(() => expect(state.commandCalls).toHaveLength(2));
    expect(state.commandCalls[0]).toMatchObject({
      action: "question.answer",
      targetId: "web-task",
      answer: "allow",
    });
    expect(state.commandCalls[1]).toMatchObject({
      action: "sources.select",
      sourcePolicy: { webEnabled: true, generalKnowledgeEnabled: true },
    });
  });

  it("does not auto-select a removed source when the session inventory changes", async () => {
    state.sourceRecords = [
      {
        id: "source-record-1",
        kind: "source",
        payload: {
          sourceVersionId: "source-1",
          filename: "guide.pdf",
          status: "failed",
          sections: [],
        },
      },
    ];
    state.sourceSelection = {
      sourceVersionIds: ["source-1"],
      webEnabled: false,
      generalKnowledgeEnabled: true,
      researchDepth: "standard",
      requiredSectionIds: [],
      excludedSectionIds: [],
    };
    const rendered = renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Remove attachment guide.pdf" }));
    expect(state.commandCalls).toHaveLength(1);
    expect(state.commandCalls[0]).toMatchObject({
      action: "sources.select",
      sourcePolicy: { sourceVersionIds: [] },
    });

    state.sourceRecords = [
      ...state.sourceRecords,
      {
        id: "source-record-2",
        kind: "source",
        payload: {
          sourceVersionId: "source-2",
          filename: "new-guide.pdf",
          status: "ready",
          sections: [],
        },
      },
    ];
    rendered.rerender(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    expect(state.commandCalls).toHaveLength(1);
  });

  it("restores a historical Apply language failure without replaying its error toast", async () => {
    state.applicationResult = {
      exportId: "historical-export",
      status: "failed",
      reason: "adminCourseView.toast.languageNotSupported",
    };
    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );
    await waitFor(() => expect(state.applicationQueryCalls.length).toBeGreaterThan(0));
    expect(state.toastCalls.filter((call) => call.variant === "destructive")).toEqual([]);
  });

  it("still announces a language failure when an observed active Apply attempt fails", async () => {
    state.applicationResult = { exportId: "active-export", status: "queued" };
    const rendered = renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );
    state.applicationResult = {
      exportId: "active-export",
      status: "failed",
      reason: "adminCourseView.toast.languageNotSupported",
    };
    rendered.rerender(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );
    await waitFor(() =>
      expect(state.toastCalls.filter((call) => call.variant === "destructive")).toHaveLength(1),
    );
  });

  it("refreshes authoring context and the session after an application is confirmed", async () => {
    state.applicationResult = { exportId: "export-context-refresh", status: "applied" };

    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    await waitFor(() => expect(state.contextRefetchCalls).toBe(1));
    expect(state.refetchCalls).toBe(1);
  });

  it("keeps a confirmed application complete when authoring-context refresh fails", async () => {
    state.applicationResult = { exportId: "export-context-refresh-error", status: "applied" };
    state.contextRefetchFails = true;

    renderWith().render(
      <CourseGenerationSession courseId="course" language="en" sessionId="session" embedded />,
    );

    await waitFor(() =>
      expect(state.toastCalls).toContainEqual({
        description: "Changes were applied. Refresh the course if they are not visible yet.",
      }),
    );
  });
});
