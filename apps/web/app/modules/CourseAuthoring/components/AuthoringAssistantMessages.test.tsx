import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import {
  activeAssistantRequestIds,
  authoringMessagesFromTurns,
  canonicalAuthoringTurns,
} from "../authoringConversation";
import { projectWorkspaceRecords } from "../courseAuthoring.records";

import { AuthoringAssistantMessages } from "./AuthoringAssistantMessages";

import type { AuthoringChatMessage } from "../authoringChatTransport";
import type {
  AuthoringRecord,
  AuthoringTurn,
  AuthoringTurnPart,
  PreviewView,
  QuestionView,
  SourceView,
} from "../courseAuthoring.types";

vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: () => ({ data: null }),
}));

vi.mock("~/api/queries/useCourseAuthoringLinkPreviewQuery", () => ({
  useCourseAuthoringLinkPreviewQuery: () => ({ data: undefined, isLoading: false }),
}));

const authoringPart = (
  requestId: string,
  messageId: string,
  part: Pick<AuthoringTurnPart, "partId" | "partKind" | "status"> &
    Partial<Pick<AuthoringTurnPart, "taskId" | "text" | "tool" | "artifact">>,
  sequence: number,
): AuthoringChatMessage["parts"][number] => ({
  type: "data-authoringPart",
  id: part.partId,
  data: {
    requestId,
    messageId,
    taskId: part.taskId ?? null,
    partId: part.partId,
    partKind: part.partKind,
    status: part.status,
    firstSequence: sequence,
    updatedSequence: sequence,
    text: part.text ?? null,
    tool: part.tool ?? null,
    artifact: part.artifact ?? null,
  },
});

describe("AuthoringAssistantMessages", () => {
  it("keeps uploaded source chips on the exact durable user turn", () => {
    const source: SourceView = {
      id: "source-1",
      name: "manager-guide.pdf",
      status: "ready",
      selected: true,
      mediaType: "application/pdf",
      readableSections: 2,
      totalSections: 2,
      warning: null,
      sections: [],
    };

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1",
            role: "user",
            parts: [{ type: "text", text: "Use the uploaded guide" }],
            metadata: { requestId: "request-1", sourceVersionIds: ["source-1"] },
          },
        ]}
        sources={[source]}
      />,
    );

    const request = screen.getByTestId("course-authoring-request-request-1");
    expect(request).toHaveTextContent("Use the uploaded guide");
    expect(request).toHaveTextContent("manager-guide.pdf");
    const content = screen.getByTestId("course-authoring-request-content-request-1");
    expect(content).not.toHaveClass("px-4", "py-2", "bg-primary-100");
    expect(content.querySelector(".bg-primary-100")).toHaveClass("px-4", "py-2");
    expect(screen.getAllByTestId("course-authoring-message-attachments")).toHaveLength(1);
    expect(screen.getByText("Use the uploaded guide")).toHaveClass("text-foreground");
    expect(screen.getByText("manager-guide.pdf")).toHaveClass("font-medium");
  });

  it("renders a repeated legacy source attachment only on its first request turn", () => {
    const source: SourceView = {
      id: "source-legacy",
      name: "legacy-notes.pdf",
      status: "ready",
      selected: true,
      mediaType: "application/pdf",
      readableSections: 1,
      totalSections: 1,
      warning: null,
      sections: [],
    };

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1",
            role: "user",
            parts: [{ type: "text", text: "First request" }],
            metadata: { requestId: "request-1", sourceVersionIds: ["source-legacy"] },
          },
          {
            id: "request-2",
            role: "user",
            parts: [{ type: "text", text: "What files did I attach?" }],
            metadata: { requestId: "request-2", sourceVersionIds: ["source-legacy"] },
          },
        ]}
        sources={[source]}
      />,
    );

    expect(screen.getByTestId("course-authoring-request-request-1")).toHaveTextContent(
      "legacy-notes.pdf",
    );
    expect(screen.getByTestId("course-authoring-request-request-2")).not.toHaveTextContent(
      "legacy-notes.pdf",
    );
    expect(screen.getAllByTestId("course-authoring-message-attachments")).toHaveLength(1);
  });

  it("shows the accepted queued source on its sent request and follows live status updates", () => {
    const records = (status: SourceView["status"]): AuthoringRecord[] => [
      {
        id: "request-record-1",
        kind: "request",
        payload: {
          requestId: "request-with-source",
          instruction: "Use the uploaded course guide",
          createdAt: "2026-09-22T09:00:00.000Z",
          sourcePolicy: {
            sourceVersionIds: ["source-accepted"],
            webEnabled: false,
            generalKnowledgeEnabled: false,
            researchDepth: "standard",
            requiredSectionIds: [],
            excludedSectionIds: [],
          },
          attachedSourceVersionIds: ["source-accepted"],
        },
      },
      {
        id: "source-record-1",
        kind: "source",
        payload: {
          sourceVersionId: "source-accepted",
          taskId: "source-task-1",
          filename: "course-guide.pdf",
          status,
        },
      },
    ];
    const durableTurn: AuthoringTurn = {
      requestId: "request-with-source",
      messageId: "response-with-source",
      status: "completed",
      taskIds: [],
      parts: [],
      firstSequence: 1,
      updatedSequence: 1,
    };
    const sourceIngestionTurn: AuthoringTurn = {
      requestId: "source-task-1",
      messageId: "source-task-message",
      status: "running",
      taskIds: ["source-task-1"],
      parts: [],
      firstSequence: 2,
      updatedSequence: 2,
    };
    const project = (sourceStatus: SourceView["status"]) => {
      const projection = projectWorkspaceRecords(records(sourceStatus));
      const activeRequestIds = activeAssistantRequestIds(
        [sourceIngestionTurn],
        projection.conversation,
      );
      return {
        messages: authoringMessagesFromTurns(
          canonicalAuthoringTurns([durableTurn], projection.conversation),
        ),
        sources: projection.sources,
        pendingTasks: [...activeRequestIds].map((requestId) => ({
          taskId: `turn-${requestId}`,
          requestId,
          phaseLabel: "Preparing your response",
        })),
      };
    };
    const queued = project("queued");
    expect(queued.pendingTasks).toEqual([]);
    const rendered = renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={queued.messages}
        sources={queued.sources}
        pendingTasks={queued.pendingTasks}
      />,
    );

    const attachments = screen.getByTestId("course-authoring-message-attachments");
    const requestMessage = screen.getByTestId("course-authoring-request-request-with-source");
    expect(attachments).toHaveTextContent("course-guide.pdf");
    expect(attachments.textContent?.match(/course-guide\.pdf/g)).toHaveLength(1);
    expect(requestMessage).toHaveTextContent("Use the uploaded course guide");
    expect(requestMessage.textContent?.match(/course-guide\.pdf/g)).toHaveLength(1);
    expect(screen.queryByText("Preparing your response")).not.toBeInTheDocument();

    const processing = project("processing");
    rendered.rerender(
      <AuthoringAssistantMessages
        chatMessages={processing.messages}
        sources={processing.sources}
        pendingTasks={processing.pendingTasks}
      />,
    );
    expect(requestMessage.textContent?.match(/course-guide\.pdf/g)).toHaveLength(1);

    const ready = project("ready");
    rendered.rerender(
      <AuthoringAssistantMessages
        chatMessages={ready.messages}
        sources={ready.sources}
        pendingTasks={ready.pendingTasks}
      />,
    );
    expect(attachments.querySelector("span.inline-flex")).toHaveClass("text-foreground");
    expect(attachments.textContent?.match(/course-guide\.pdf/g)).toHaveLength(1);
    expect(requestMessage.textContent?.match(/course-guide\.pdf/g)).toHaveLength(1);
  });

  it("renders an optimistic request attachment without delete affordance", () => {
    const source: SourceView = {
      id: "source-pending",
      name: "field-handbook.pdf",
      status: "processing",
      selected: true,
      mediaType: "application/pdf",
      readableSections: 0,
      totalSections: 0,
      warning: null,
      sections: [],
    };

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "command-pending",
            role: "user",
            parts: [{ type: "text", text: "Use the field handbook" }],
            metadata: {
              commandId: "command-pending",
              sourceVersionIds: ["source-pending"],
              turnStatus: "sending",
            },
          },
        ]}
        sources={[source]}
      />,
    );

    const attachments = screen.getByTestId("course-authoring-message-attachments");
    expect(attachments).toHaveTextContent("field-handbook.pdf");
    expect(screen.queryByRole("button", { name: /Remove source/ })).not.toBeInTheDocument();
  });

  it("keeps the response shimmer visible during streaming and removes it after the final turn", () => {
    const user: AuthoringChatMessage = {
      id: "command-1",
      role: "user",
      parts: [{ type: "text", text: "Add a chapter about Mentingo" }],
      metadata: { commandId: "command-1", requestId: "request-1" },
    };
    const rendered = renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[user]}
        pendingTasks={[
          {
            taskId: "chat-request-1",
            requestId: "request-1",
            phaseLabel: "Preparing your response",
          },
        ]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Preparing your response");
    expect(screen.getAllByTestId("course-authoring-request-request-1")).toHaveLength(1);

    const assistant: AuthoringChatMessage = {
      id: "request-1-assistant",
      role: "assistant",
      metadata: { requestId: "request-1", turnStatus: "completed", updatedSequence: 2 },
      parts: [
        authoringPart(
          "request-1",
          "request-1-assistant",
          {
            partId: "final-response",
            partKind: "text",
            status: "completed",
            text: "Here is the final chapter outline.",
          },
          2,
        ),
      ],
    };
    rendered.rerender(
      <AuthoringAssistantMessages chatMessages={[user, assistant]} pendingTasks={[]} />,
    );

    expect(screen.queryByText("Preparing your response")).not.toBeInTheDocument();
    expect(screen.getByText("Here is the final chapter outline.")).toBeInTheDocument();
  });

  it("keeps a preview in its owning turn when later messages arrive", () => {
    const preview: PreviewView = {
      id: "preview-1",
      taskId: "task-1",
      requestId: "request-1",
      revision: 1,
      status: "running",
      title: "Safety lesson",
      lessonTitle: null,
      contentText: "Draft content",
      outline: [],
    };
    const messages: AuthoringChatMessage[] = [
      {
        id: "request-1",
        role: "user",
        parts: [{ type: "text", text: "Draft safety lesson" }],
        metadata: { requestId: "request-1" },
      },
      {
        id: "request-1-assistant",
        role: "assistant",
        parts: [
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "text-1",
              partKind: "text",
              status: "completed",
              text: "The draft is underway.",
            },
            2,
          ),
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "tool-1",
              partKind: "tool",
              taskId: "task-1",
              status: "streaming",
              tool: {
                toolCallId: "tool-1",
                toolName: "lesson_generation",
                display: "Generating lesson",
                status: "started",
                result: null,
              },
            },
            3,
          ),
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "text-1b",
              partKind: "text",
              taskId: "task-1",
              status: "streaming",
              text: "The lesson details are following.",
            },
            4,
          ),
        ],
        metadata: { requestId: "request-1" },
      },
      {
        id: "request-2",
        role: "user",
        parts: [{ type: "text", text: "Now add a quiz" }],
        metadata: { requestId: "request-2" },
      },
      {
        id: "request-2-assistant",
        role: "assistant",
        parts: [
          authoringPart(
            "request-2",
            "request-2-assistant",
            {
              partId: "text-2",
              partKind: "text",
              status: "completed",
              text: "The quiz is ready.",
            },
            5,
          ),
        ],
        metadata: { requestId: "request-2" },
      },
    ];

    const rendered = renderWith().render(
      <AuthoringAssistantMessages chatMessages={messages} previews={[preview]} />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    expect(screen.getAllByRole("region", { name: "Live preview" })).toHaveLength(1);
    expect(transcript.textContent?.indexOf("The draft is underway.")).toBeLessThan(
      transcript.textContent?.indexOf("Safety lesson") ?? -1,
    );
    expect(transcript.textContent?.indexOf("Safety lesson")).toBeLessThan(
      transcript.textContent?.indexOf("Now add a quiz") ?? -1,
    );

    rendered.rerender(
      <AuthoringAssistantMessages
        chatMessages={messages}
        previews={[{ ...preview, revision: 2, title: "Updated safety lesson" }]}
      />,
    );

    expect(screen.getAllByRole("region", { name: "Live preview" })).toHaveLength(1);
    expect(screen.queryByText("Safety lesson", { exact: true })).toBeNull();
    expect(screen.getByText("Updated safety lesson")).toBeInTheDocument();
    expect(transcript.textContent?.indexOf("Updated safety lesson")).toBeLessThan(
      transcript.textContent?.indexOf("Now add a quiz") ?? -1,
    );
  });

  it("keeps two durable request turns ordered while attaching delayed replies", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1",
            role: "user",
            parts: [{ type: "text", text: "Create a lesson." }],
            metadata: { requestId: "request-1" },
          },
          {
            id: "request-1-assistant",
            role: "assistant",
            parts: [
              {
                type: "data-authoringPart",
                data: {
                  requestId: "request-1",
                  messageId: "request-1-assistant",
                  taskId: null,
                  partId: "part-1",
                  partKind: "text",
                  status: "completed",
                  firstSequence: 2,
                  updatedSequence: 2,
                  text: "The lesson draft is ready.",
                  tool: null,
                  artifact: null,
                },
              },
            ],
            metadata: { requestId: "request-1" },
          },
          {
            id: "request-2",
            role: "user",
            parts: [{ type: "text", text: "Add a quiz." }],
            metadata: { requestId: "request-2" },
          },
          {
            id: "request-2-assistant",
            role: "assistant",
            parts: [
              {
                type: "data-authoringPart",
                data: {
                  requestId: "request-2",
                  messageId: "request-2-assistant",
                  taskId: null,
                  partId: "part-2",
                  partKind: "text",
                  status: "completed",
                  firstSequence: 4,
                  updatedSequence: 4,
                  text: "The quiz draft is ready.",
                  tool: null,
                  artifact: null,
                },
              },
            ],
            metadata: { requestId: "request-2" },
          },
        ]}
      />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    const transcriptText = transcript.textContent ?? "";
    expect(transcriptText.match(/Create a lesson\./g)).toHaveLength(1);
    expect(transcriptText.match(/Add a quiz\./g)).toHaveLength(1);
    expect(transcriptText.indexOf("Create a lesson.")).toBeLessThan(
      transcriptText.indexOf("The lesson draft is ready."),
    );
    expect(transcriptText.indexOf("The lesson draft is ready.")).toBeLessThan(
      transcriptText.indexOf("Add a quiz."),
    );
    expect(transcriptText.indexOf("Add a quiz.")).toBeLessThan(
      transcriptText.indexOf("The quiz draft is ready."),
    );
  });

  it("places late task activity and a proposal below intervening chat turns", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1",
            role: "user",
            parts: [{ type: "text", text: "Create a lesson." }],
            metadata: { requestId: "request-1", firstSequence: 1 },
          },
          {
            id: "request-1-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "text-1",
                  partKind: "text",
                  status: "completed",
                  text: "I will prepare the lesson.",
                },
                2,
              ),
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "task-1",
                  partKind: "tool",
                  taskId: "task-1",
                  status: "completed",
                },
                7,
              ),
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "proposal-1",
                  partKind: "proposal",
                  taskId: "task-1",
                  status: "review",
                  artifact: { artifactKind: "proposal", artifactId: "proposal-1" },
                },
                8,
              ),
            ],
            metadata: { requestId: "request-1", firstSequence: 1, updatedSequence: 8 },
          },
          {
            id: "request-2",
            role: "user",
            parts: [{ type: "text", text: "Now add a quiz." }],
            metadata: { requestId: "request-2", firstSequence: 5 },
          },
          {
            id: "request-2-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-2",
                "request-2-assistant",
                {
                  partId: "text-2",
                  partKind: "text",
                  status: "completed",
                  text: "The quiz is ready.",
                },
                6,
              ),
            ],
            metadata: { requestId: "request-2", firstSequence: 5, updatedSequence: 6 },
          },
        ]}
        taskActivities={[
          {
            taskId: "task-1",
            requestId: "request-1",
            content: <div data-testid="late-task-activity">Lesson task update</div>,
          },
        ]}
        proposalGroups={[
          {
            taskId: "task-1",
            requestId: "request-1",
            proposalIds: ["proposal-1"],
            content: <div data-testid="late-proposal-group">Review lesson proposal</div>,
          },
        ]}
      />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    const text = transcript.textContent ?? "";
    expect(text.indexOf("Create a lesson.")).toBeLessThan(text.indexOf("Now add a quiz."));
    expect(text.indexOf("Now add a quiz.")).toBeLessThan(text.indexOf("The quiz is ready."));
    expect(text.indexOf("The quiz is ready.")).toBeLessThan(text.indexOf("Lesson task update"));
    expect(text.indexOf("Lesson task update")).toBeLessThan(text.indexOf("Review lesson proposal"));
    expect(screen.getAllByTestId("late-proposal-group")).toHaveLength(1);
  });

  it("shows a pending assistant loader in the owning request turn", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1",
            role: "user",
            parts: [{ type: "text", text: "Create a lesson." }],
            metadata: { requestId: "request-1" },
          },
        ]}
        pendingTasks={[{ taskId: "task-1", requestId: "request-1" }]}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Working on your request");
    expect(status.querySelector(".loading-text-shimmer")).toHaveTextContent(
      "Working on your request",
    );
  });

  it("keeps concurrent live work inside its request response", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1",
            role: "user",
            parts: [{ type: "text", text: "Create a lesson." }],
            metadata: { requestId: "request-1" },
          },
          {
            id: "request-1-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "part-1",
                  partKind: "text",
                  status: "completed",
                  text: "Working on the lesson.",
                },
                2,
              ),
            ],
            metadata: { requestId: "request-1" },
          },
          {
            id: "request-2",
            role: "user",
            parts: [{ type: "text", text: "Add a quiz." }],
            metadata: { requestId: "request-2" },
          },
          {
            id: "request-2-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-2",
                "request-2-assistant",
                {
                  partId: "part-2",
                  partKind: "text",
                  status: "completed",
                  text: "Working on the quiz.",
                },
                4,
              ),
            ],
            metadata: { requestId: "request-2" },
          },
        ]}
        taskActivities={[
          {
            taskId: "task-request-1",
            requestId: "request-1",
            content: <div data-testid="activity-request-1">Lesson work</div>,
          },
          {
            taskId: "task-request-2",
            requestId: "request-2",
            content: <div data-testid="activity-request-2">Quiz work</div>,
          },
        ]}
      />,
    );

    const firstActivity = screen.getByTestId("activity-request-1");
    const secondActivity = screen.getByTestId("activity-request-2");
    expect(firstActivity.closest("section")).toContainElement(
      screen.getByTestId("course-authoring-request-request-1"),
    );
    expect(secondActivity.closest("section")).toContainElement(
      screen.getByTestId("course-authoring-request-request-2"),
    );
    expect(firstActivity.closest("section")).not.toContainElement(secondActivity);
  });

  it("keeps ordered assistant text and tool activity under one assistant header", () => {
    const chatMessages: AuthoringChatMessage[] = [
      {
        id: "request-1",
        role: "user",
        parts: [{ type: "text", text: "Research this" }],
        metadata: { requestId: "request-1" },
      },
      {
        id: "request-1-assistant",
        role: "assistant",
        parts: [
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "text-1",
              partKind: "text",
              status: "completed",
              text: "I will check the sources.",
            },
            2,
          ),
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "tool-1",
              partKind: "tool",
              taskId: "task-1",
              status: "streaming",
              tool: {
                toolCallId: "tool-1",
                toolName: "web_search",
                display: "Searching sources",
                status: "started",
                result: null,
              },
            },
            3,
          ),
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "text-2",
              partKind: "text",
              status: "completed",
              text: "Here is what I found.",
            },
            4,
          ),
        ],
        metadata: { requestId: "request-1" },
      },
    ];

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={chatMessages}
        taskActivities={[
          {
            taskId: "task-1",
            requestId: "request-1",
            content: <div data-testid="assistant-tool-task">Searching sources</div>,
          },
        ]}
        pendingTasks={[
          { taskId: "task-1", requestId: "request-1", phaseLabel: "Preparing response" },
        ]}
      />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    expect(screen.getAllByTestId("course-authoring-assistant-request-1")).toHaveLength(1);
    const toolRow = screen.getByTestId("course-authoring-tool-tool-1");
    expect(toolRow).toHaveTextContent("Searching the web");
    expect(toolRow).not.toHaveTextContent("Running");
    expect(toolRow).not.toHaveClass("border");
    expect(toolRow).toHaveAttribute("title", "Searching sources");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByText("Preparing response")).not.toBeInTheDocument();
    expect(transcript.textContent?.indexOf("I will check the sources.")).toBeLessThan(
      transcript.textContent?.indexOf("Searching the web") ?? -1,
    );
    expect(transcript.textContent?.indexOf("Searching the web")).toBeLessThan(
      transcript.textContent?.indexOf("Here is what I found.") ?? -1,
    );
  });

  it("deduplicates same-owner live work while retaining and labeling distinct lesson tasks", () => {
    const user = {
      id: "optimistic-request",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Write two lessons" }],
      metadata: { requestId: "request-1", commandId: "command-1", firstSequence: 1 },
    };
    const durableUser = {
      ...user,
      id: "durable-request",
      metadata: { requestId: "request-1", firstSequence: 1 },
    };
    const streamAssistant: AuthoringChatMessage = {
      id: "stream-assistant",
      role: "assistant",
      metadata: { requestId: "request-1" },
      parts: [
        authoringPart(
          "request-1",
          "stream-assistant",
          {
            partId: "web-tool-stream",
            partKind: "tool",
            taskId: "task-a",
            status: "streaming",
            tool: {
              toolCallId: "web-tool-a",
              toolName: "web_search",
              display: "Searching sources",
              status: "started",
              result: null,
            },
          },
          2,
        ),
      ],
    };
    const durableAssistant: AuthoringChatMessage = {
      id: "durable-assistant",
      role: "assistant",
      metadata: { requestId: "request-1" },
      parts: [
        authoringPart(
          "request-1",
          "durable-assistant",
          {
            partId: "web-tool-durable",
            partKind: "tool",
            taskId: "task-a",
            status: "completed",
            tool: {
              toolCallId: "web-tool-a",
              toolName: "web_search",
              display: "Searching sources",
              status: "completed",
              result: null,
            },
          },
          3,
        ),
        authoringPart(
          "request-1",
          "durable-assistant",
          {
            partId: "web-tool-second-task",
            partKind: "tool",
            taskId: "task-b",
            status: "streaming",
            tool: {
              toolCallId: "web-tool-b",
              toolName: "web_search",
              display: "Searching sources",
              status: "started",
              result: null,
            },
          },
          4,
        ),
      ],
    };

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[user, durableUser, streamAssistant, durableAssistant]}
        taskLabels={{ "task-a": "Writing a lesson · 1", "task-b": "Writing a lesson · 2" }}
        pendingTasks={[
          { taskId: "task-a", requestId: "request-1", phaseLabel: "Writing a lesson · 1" },
          { taskId: "task-b", requestId: "request-1", phaseLabel: "Writing a lesson · 2" },
        ]}
        taskActivities={[
          {
            taskId: "task-a",
            requestId: "request-1",
            content: <div data-testid="task-a-activity">Live work 0 of 1 complete</div>,
          },
          {
            taskId: "task-a",
            requestId: "request-1",
            content: <div data-testid="duplicate-task-a-activity">Duplicate live work</div>,
          },
          {
            taskId: "task-b",
            requestId: "request-1",
            content: <div data-testid="task-b-activity">Live work 0 of 1 complete</div>,
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId("course-authoring-request-request-1")).toHaveLength(1);
    expect(screen.getAllByTestId("course-authoring-tool-web-tool-a")).toHaveLength(1);
    expect(screen.getAllByTestId("course-authoring-tool-web-tool-b")).toHaveLength(1);
    expect(screen.getByTestId("task-a-activity")).toBeInTheDocument();
    expect(screen.getByTestId("task-b-activity")).toBeInTheDocument();
    expect(screen.queryByTestId("duplicate-task-a-activity")).not.toBeInTheDocument();
    expect(screen.getByTestId("course-authoring-tool-web-tool-a")).toHaveTextContent(
      "Writing a lesson · 1",
    );
    expect(screen.getByTestId("course-authoring-tool-web-tool-b")).toHaveTextContent(
      "Writing a lesson · 2",
    );
  });

  it("renders a capability question once at its durable turn position and records Allow", async () => {
    const user = userEvent.setup();
    const question: QuestionView = {
      id: "question-web",
      taskId: "task-web",
      requestId: "request-1",
      revision: 2,
      prompt: "Allow web search for this request?",
      choices: [],
      capability: "web_search",
      reason: "A longer explanation should stay hidden from this compact prompt.",
      answer: null,
      answered: false,
    };
    const onAnswerQuestion = vi.fn(async () => undefined);
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1",
            role: "user",
            parts: [{ type: "text", text: "Research this topic" }],
            metadata: { requestId: "request-1" },
          },
          {
            id: "request-1-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "progress-1",
                  partKind: "text",
                  status: "streaming",
                  text: "Checking your request and course context",
                },
                2,
              ),
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "question-part-1",
                  partKind: "question",
                  status: "review",
                  taskId: "task-web",
                  artifact: { artifactKind: "question", artifactId: "question-web" },
                },
                3,
              ),
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "question-part-duplicate",
                  partKind: "question",
                  status: "review",
                  taskId: "task-web",
                  artifact: { artifactKind: "question", artifactId: "question-web" },
                },
                4,
              ),
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "final-1",
                  partKind: "text",
                  status: "completed",
                  text: "Here is the result.",
                },
                5,
              ),
            ],
            metadata: { requestId: "request-1" },
          },
        ]}
        questionsByRequest={{ "request-1": [question] }}
        onAnswerQuestion={onAnswerQuestion}
      />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    const transcriptText = transcript.textContent ?? "";
    expect(screen.getByTestId("course-authoring-assistant-request-1")).toHaveTextContent(
      "Checking your request and course context",
    );
    expect(screen.getByTestId("course-authoring-assistant-request-1")).toHaveTextContent(
      "Here is the result.",
    );
    expect(screen.getAllByText("Assistant")).toHaveLength(2);
    expect(transcriptText.indexOf("Checking your request and course context")).toBeLessThan(
      transcriptText.indexOf("Search the web?"),
    );
    expect(transcriptText.indexOf("Here is the result.")).toBeLessThan(
      transcriptText.indexOf("Search the web?"),
    );
    expect(transcriptText).not.toContain(question.prompt);
    expect(transcriptText).not.toContain(question.reason);
    const questionCard = screen.getByTestId("course-authoring-question-question-web");
    expect(screen.getAllByTestId("course-authoring-question-question-web")).toHaveLength(1);
    expect(questionCard).toHaveClass("flex");
    expect(questionCard).not.toHaveClass("border");
    expect(questionCard).not.toHaveClass("bg-neutral-50");
    expect(screen.getByTestId("authoring-progress-part")).toHaveClass("text-muted-foreground");
    expect(
      screen.getByTestId("authoring-progress-part").querySelector(".loading-text-shimmer"),
    ).toBeInTheDocument();
    expect(transcript.querySelectorAll("button button")).toHaveLength(0);
    const finalText = screen.getByText("Here is the result.");
    expect(finalText.parentElement?.parentElement).toHaveClass("text-foreground");
    expect(finalText.closest(".loading-text-shimmer")).not.toBeInTheDocument();

    const allowButton = screen.getByRole("button", { name: "Allow" });
    expect(allowButton).toHaveClass("h-7");
    expect(allowButton).toHaveClass("border-primary-300");
    expect(screen.getByRole("button", { name: "Deny" })).toHaveClass("border-neutral-300");
    await user.click(allowButton);
    expect(onAnswerQuestion).toHaveBeenCalledWith(question, "allow");
    expect(await screen.findByRole("status")).toHaveTextContent("Web search allowed");
    expect(screen.queryByRole("button", { name: "Allow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deny" })).not.toBeInTheDocument();
  });

  it("keeps an answered question at its original position after later updates", () => {
    const question: QuestionView = {
      id: "question-audience",
      taskId: "task-lesson",
      requestId: "request-1",
      revision: 1,
      prompt: "Who is this course for?",
      choices: [],
      capability: null,
      reason: null,
      answer: null,
      answered: false,
    };
    const questionPart = (updatedSequence: number) => {
      const part = authoringPart(
        "request-1",
        "request-1-assistant",
        {
          partId: "question-audience-part",
          partKind: "question",
          status: "review",
          taskId: "task-lesson",
          artifact: { artifactKind: "question", artifactId: question.id },
        },
        3,
      );
      if (part.type !== "data-authoringPart") return part;
      return { ...part, data: { ...part.data, updatedSequence } };
    };
    const openingPart = (updatedSequence: number, text: string) => {
      const part = authoringPart(
        "request-1",
        "request-1-assistant",
        {
          partId: "opening-text",
          partKind: "text",
          status: "completed",
          text,
        },
        2,
      );
      if (part.type !== "data-authoringPart") return part;
      return { ...part, data: { ...part.data, updatedSequence } };
    };
    const messages = (
      questionUpdatedSequence: number,
      openingUpdatedSequence: number,
      openingText: string,
    ): AuthoringChatMessage[] => [
      {
        id: "request-1",
        role: "user",
        parts: [{ type: "text", text: "Create a course for my team." }],
        metadata: { requestId: "request-1", firstSequence: 1 },
      },
      {
        id: "request-1-assistant",
        role: "assistant",
        parts: [
          openingPart(openingUpdatedSequence, openingText),
          questionPart(questionUpdatedSequence),
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "late-task-update",
              partKind: "tool",
              taskId: "task-lesson",
              status: "completed",
            },
            9,
          ),
        ],
        metadata: { requestId: "request-1", firstSequence: 1, updatedSequence: 10 },
      },
      {
        id: "request-2",
        role: "user",
        parts: [{ type: "text", text: "Also include a quiz." }],
        metadata: { requestId: "request-2", firstSequence: 5 },
      },
      {
        id: "request-2-assistant",
        role: "assistant",
        parts: [
          authoringPart(
            "request-2",
            "request-2-assistant",
            {
              partId: "quiz-response",
              partKind: "text",
              status: "completed",
              text: "The quiz will cover the key ideas.",
            },
            6,
          ),
        ],
        metadata: { requestId: "request-2", firstSequence: 5, updatedSequence: 6 },
      },
    ];
    const rendered = renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={messages(3, 2, "I can help with that.")}
        questionsByRequest={{ "request-1": [question] }}
      />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    const promptIndex = () => transcript.textContent?.indexOf(question.prompt) ?? -1;
    const firstRequestIndex = () =>
      transcript.textContent?.indexOf("Create a course for my team.") ?? -1;
    const laterRequestIndex = () => transcript.textContent?.indexOf("Also include a quiz.") ?? -1;
    expect(firstRequestIndex()).toBeLessThan(promptIndex());
    expect(laterRequestIndex()).toBeLessThan(promptIndex());

    rendered.rerender(
      <AuthoringAssistantMessages
        chatMessages={messages(12, 11, "I prepared a scoped edit.")}
        questionsByRequest={{
          "request-1": [{ ...question, answer: "First-time managers", answered: true }],
        }}
      />,
    );

    expect(screen.getByTestId("course-authoring-question-question-audience")).toHaveTextContent(
      "Your answer: First-time managers",
    );
    expect(firstRequestIndex()).toBeLessThan(promptIndex());
    expect(promptIndex()).toBeLessThan(laterRequestIndex());
    expect(laterRequestIndex()).toBeLessThan(
      transcript.textContent?.indexOf("I prepared a scoped edit.") ?? -1,
    );
  });

  it("keeps the plan at its route message and places later progress after the reply", async () => {
    const user = userEvent.setup();
    const question: QuestionView = {
      id: "course-title-question",
      taskId: "title-task",
      requestId: "title-request",
      revision: 1,
      prompt: "What would you like the course title changed to?",
      choices: [],
      capability: null,
      reason: null,
      answer: "Mentingo: Onboarding",
      answered: true,
    };
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "title-request",
            role: "user",
            parts: [{ type: "text", text: "Rename the course." }],
            metadata: { requestId: "title-request", firstSequence: 1 },
          },
          {
            id: "title-request-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "title-request",
                "title-request-assistant",
                {
                  partId: "route-plan",
                  partKind: "text",
                  taskId: "title-task",
                  status: "completed",
                  text: "I can update the title.",
                },
                2,
              ),
              authoringPart(
                "title-request",
                "title-request-assistant",
                {
                  partId: "title-question",
                  partKind: "question",
                  taskId: "title-task",
                  status: "completed",
                  artifact: { artifactKind: "question", artifactId: question.id },
                },
                3,
              ),
              authoringPart(
                "title-request",
                "title-request-assistant",
                {
                  partId: "final-edit",
                  partKind: "text",
                  taskId: "title-task",
                  status: "completed",
                  text: "I prepared a scoped edit for review.",
                },
                6,
              ),
            ],
            metadata: { requestId: "title-request", firstSequence: 1, updatedSequence: 7 },
          },
        ]}
        questionsByRequest={{ "title-request": [question] }}
        plans={[
          {
            id: "title-plan",
            requestId: "title-request",
            taskId: "title-task",
            partId: "route-plan",
            firstSequence: 2,
            message: "I can update the title.",
            planSteps: ["Confirm the title", "Prepare the edit"],
          },
        ]}
        taskActivities={[
          {
            taskId: "title-task",
            requestId: "title-request",
            sequence: 7,
            content: <div>Live work complete</div>,
          },
        ]}
      />,
    );

    const planToggle = screen.getByRole("button", { name: /^Plan/ });
    expect(planToggle).toHaveAttribute("aria-expanded", "false");
    expect(planToggle).toHaveTextContent("2 steps");
    expect(screen.queryByText("Confirm the title")).toBeNull();
    await user.click(planToggle);

    const text = screen.getByTestId("course-authoring-assistant-messages").textContent ?? "";
    expect(text.indexOf("I can update the title.")).toBeLessThan(text.indexOf("Confirm the title"));
    expect(text.indexOf("Confirm the title")).toBeLessThan(text.indexOf(question.prompt));
    expect(text.indexOf(question.prompt)).toBeLessThan(text.indexOf("Your answer"));
    expect(text.indexOf("Your answer")).toBeLessThan(
      text.indexOf("I prepared a scoped edit for review."),
    );
    expect(text.indexOf("I prepared a scoped edit for review.")).toBeLessThan(
      text.indexOf("Live work complete"),
    );
  });

  it("renders an already denied capability as resolved without asking again", () => {
    const question: QuestionView = {
      id: "question-web-denied",
      taskId: "task-web",
      requestId: "request-denied",
      revision: 2,
      prompt: "Allow web search for this request?",
      choices: [],
      capability: "web_search",
      reason: "Current sources will improve this course request.",
      answer: "deny",
      answered: true,
    };

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-denied-assistant",
            role: "assistant",
            parts: [],
            metadata: { requestId: "request-denied" },
          },
        ]}
        questionsByRequest={{ "request-denied": [question] }}
        onAnswerQuestion={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByTestId("course-authoring-question-question-web-denied")).toHaveTextContent(
      "Web search denied",
    );
    expect(screen.queryByRole("button", { name: "Allow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });

  it("shows a persisted clarification answer and does not restore the answer form", () => {
    const answer = "The course is for first-time people managers.";
    const question: QuestionView = {
      id: "question-clarification",
      taskId: "task-clarification",
      requestId: "request-clarification",
      revision: 4,
      prompt: "Who is the course for?",
      choices: [],
      capability: null,
      reason: null,
      answer,
      answered: true,
    };

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-clarification-assistant",
            role: "assistant",
            parts: [],
            metadata: { requestId: "request-clarification" },
          },
        ]}
        questionsByRequest={{ "request-clarification": [question] }}
        onAnswerQuestion={vi.fn(async () => undefined)}
      />,
    );

    const card = screen.getByTestId("course-authoring-question-question-clarification");
    expect(card).toHaveTextContent("Who is the course for?");
    expect(card).toHaveTextContent(`Your answer: ${answer}`);
    expect(card.querySelector("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your answer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Answer" })).not.toBeInTheDocument();
  });

  it("keeps an answered revision visible and starts a new revision with an empty answer", async () => {
    const user = userEvent.setup();
    const initialQuestion: QuestionView = {
      id: "question-revised",
      taskId: "task-revised",
      requestId: "request-revised",
      revision: 1,
      prompt: "What is the audience?",
      choices: [],
      capability: null,
      reason: null,
      answer: null,
      answered: false,
    };
    const messages: AuthoringChatMessage[] = [
      {
        id: "request-revised-assistant",
        role: "assistant",
        parts: [],
        metadata: { requestId: "request-revised" },
      },
    ];
    const onAnswerQuestion = vi.fn(async () => undefined);
    const rendered = renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={messages}
        questionsByRequest={{ "request-revised": [initialQuestion] }}
        onAnswerQuestion={onAnswerQuestion}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "New teachers");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(await screen.findByText("New teachers", { exact: true })).toBeVisible();

    const answeredQuestion: QuestionView = {
      ...initialQuestion,
      answer: "New teachers",
      answered: true,
    };
    const revisedQuestion: QuestionView = {
      ...initialQuestion,
      revision: 2,
      prompt: "Which teaching experience should the course assume?",
    };
    rendered.rerender(
      <AuthoringAssistantMessages
        chatMessages={messages}
        questionsByRequest={{ "request-revised": [answeredQuestion, revisedQuestion] }}
        onAnswerQuestion={onAnswerQuestion}
      />,
    );

    expect(screen.getByText("What is the audience?")).toBeVisible();
    expect(screen.getByText("Which teaching experience should the course assume?")).toBeVisible();
    expect(screen.getByText("Your answer:")).toBeVisible();
    expect(screen.getByText("New teachers", { exact: true })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
    expect(onAnswerQuestion).toHaveBeenCalledWith(initialQuestion, "New teachers");
  });

  it("records Deny as a denial for the web-search permission", async () => {
    const user = userEvent.setup();
    const question: QuestionView = {
      id: "question-web-skip",
      taskId: "task-web",
      requestId: "request-skip",
      revision: 1,
      prompt: "Use web search?",
      choices: [],
      capability: "web_search",
      reason: null,
      answer: null,
      answered: false,
    };
    const onAnswerQuestion = vi.fn(async () => undefined);

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-skip-assistant",
            role: "assistant",
            parts: [],
            metadata: { requestId: "request-skip" },
          },
        ]}
        questionsByRequest={{ "request-skip": [question] }}
        onAnswerQuestion={onAnswerQuestion}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(onAnswerQuestion).toHaveBeenCalledWith(question, "deny");
    expect(await screen.findByRole("status")).toHaveTextContent("Web search denied");
  });

  it("shows one pending question with three suggestions and a free-text alternative", async () => {
    const user = userEvent.setup();
    const onAnswerQuestion = vi.fn(async () => undefined);
    const first: QuestionView = {
      id: "first-question",
      taskId: "first-task",
      requestId: "request-questions",
      revision: 1,
      prompt: "Who is the course for?",
      choices: ["New hires", "Managers", "Administrators"],
      capability: null,
      reason: null,
      answer: null,
      answered: false,
    };
    const second: QuestionView = {
      ...first,
      id: "second-question",
      taskId: "second-task",
      prompt: "How long should it be?",
      choices: ["Short", "Medium", "Long"],
    };

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[]}
        questionsByRequest={{ "request-questions": [first, second] }}
        onAnswerQuestion={onAnswerQuestion}
      />,
    );

    expect(screen.getByText("Question 1 of 2")).toBeVisible();
    expect(screen.getByText(first.prompt)).toBeVisible();
    expect(screen.queryByText(second.prompt)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A. New hires" })).toBeVisible();
    expect(screen.getByRole("button", { name: "B. Managers" })).toBeVisible();
    expect(screen.getByRole("button", { name: "C. Administrators" })).toBeVisible();
    expect(screen.getByRole("button", { name: "D. Other…" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "D. Other…" }));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "Support team");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(onAnswerQuestion).toHaveBeenCalledWith(first, "Support team");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(second.prompt)).toBeVisible();
  });

  it("places a proposal at its server part position without adding another assistant header", () => {
    const chatMessages: AuthoringChatMessage[] = [
      {
        id: "request-1",
        role: "user",
        parts: [{ type: "text", text: "Draft this" }],
        metadata: { requestId: "request-1" },
      },
      {
        id: "request-1-assistant",
        role: "assistant",
        parts: [
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "text-1",
              partKind: "text",
              status: "completed",
              text: "Here is the draft.",
            },
            2,
          ),
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "part-proposal-1",
              partKind: "proposal",
              taskId: "task-1",
              status: "review",
              artifact: { artifactKind: "proposal", artifactId: "proposal-1" },
            },
            3,
          ),
          authoringPart(
            "request-1",
            "request-1-assistant",
            {
              partId: "text-2",
              partKind: "text",
              status: "completed",
              text: "Review it when ready.",
            },
            4,
          ),
        ],
        metadata: { requestId: "request-1", turnStatus: "completed" },
      },
    ];

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={chatMessages}
        proposalById={{ "proposal-1": <div data-testid="proposal-1">Proposal card</div> }}
      />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    expect(screen.getAllByTestId("course-authoring-assistant-request-1")).toHaveLength(1);
    expect(screen.getByTestId("proposal-1")).toBeVisible();
    expect(transcript.textContent?.indexOf("Here is the draft.")).toBeLessThan(
      transcript.textContent?.indexOf("Proposal card") ?? -1,
    );
    expect(transcript.textContent?.indexOf("Proposal card")).toBeLessThan(
      transcript.textContent?.indexOf("Review it when ready.") ?? -1,
    );
  });

  it("keeps proposal review groups at their task stages within one request", () => {
    const chatMessages: AuthoringChatMessage[] = [
      {
        id: "request-group",
        role: "user",
        parts: [{ type: "text", text: "Create an onboarding course" }],
        metadata: { requestId: "request-group" },
      },
      {
        id: "request-group-assistant",
        role: "assistant",
        parts: [
          authoringPart(
            "request-group",
            "request-group-assistant",
            {
              partId: "proposal-one",
              partKind: "proposal",
              taskId: "task-one",
              status: "review",
              artifact: { artifactKind: "proposal", artifactId: "proposal-one" },
            },
            2,
          ),
          authoringPart(
            "request-group",
            "request-group-assistant",
            {
              partId: "proposal-two",
              partKind: "proposal",
              taskId: "task-two",
              status: "review",
              artifact: { artifactKind: "proposal", artifactId: "proposal-two" },
            },
            3,
          ),
        ],
        metadata: { requestId: "request-group", turnStatus: "completed" },
      },
    ];

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={chatMessages}
        proposalGroups={[
          {
            taskId: "task-one",
            requestId: "request-group",
            proposalIds: ["proposal-one"],
            content: <div data-testid="request-group-review-one">Course outline ready</div>,
          },
          {
            taskId: "task-two",
            requestId: "request-group",
            proposalIds: ["proposal-two"],
            content: <div data-testid="request-group-review-two">Lesson changes ready</div>,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("request-group-review-one")).toBeVisible();
    expect(screen.getByTestId("request-group-review-two")).toBeVisible();
    expect(screen.getAllByTestId("request-group-review-one")).toHaveLength(1);
    expect(screen.getAllByTestId("request-group-review-two")).toHaveLength(1);
  });

  it("orders the final response, current task activity and review chronologically", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-ordered",
            role: "user",
            parts: [{ type: "text", text: "Build a lesson" }],
            metadata: { requestId: "request-ordered" },
          },
          {
            id: "request-ordered-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-ordered",
                "request-ordered-assistant",
                {
                  partId: "initial",
                  partKind: "text",
                  status: "completed",
                  text: "I will prepare it.",
                },
                2,
              ),
              authoringPart(
                "request-ordered",
                "request-ordered-assistant",
                {
                  partId: "proposal",
                  partKind: "proposal",
                  taskId: "task-ordered",
                  status: "review",
                  artifact: { artifactKind: "proposal", artifactId: "proposal-1" },
                },
                6,
              ),
              authoringPart(
                "request-ordered",
                "request-ordered-assistant",
                {
                  partId: "final",
                  partKind: "text",
                  status: "completed",
                  text: "Changes are ready.",
                },
                4,
              ),
            ],
            metadata: { requestId: "request-ordered", turnStatus: "completed" },
          },
        ]}
        taskActivities={[
          {
            taskId: "task-ordered",
            requestId: "request-ordered",
            sequence: 5,
            content: <div>Live work</div>,
          },
        ]}
        plans={[
          {
            id: "plan-ordered",
            requestId: "request-ordered",
            taskId: "task-ordered",
            partId: "initial",
            firstSequence: 2,
            message: "I will prepare it.",
            planSteps: ["Plan steps"],
          },
        ]}
        proposalGroups={[
          {
            taskId: "task-ordered",
            requestId: "request-ordered",
            proposalIds: ["proposal-1"],
            content: <div>Review changes card</div>,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Plan/ }));

    const transcript = screen.getByTestId("course-authoring-assistant-messages").textContent ?? "";
    expect(transcript.indexOf("I will prepare it.")).toBeLessThan(transcript.indexOf("Plan steps"));
    expect(transcript.indexOf("Plan steps")).toBeLessThan(transcript.indexOf("Changes are ready."));
    expect(transcript.indexOf("Changes are ready.")).toBeLessThan(transcript.indexOf("Live work"));
    expect(transcript.indexOf("Live work")).toBeLessThan(transcript.indexOf("Review changes card"));
  });

  it("renders web links as source chips and collapses a trailing source list", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "final-1",
                  partKind: "text",
                  status: "completed",
                  text: [
                    "Mentingo supports [guided onboarding](https://docs.mentingo.com/onboarding) for new admins.",
                    "",
                    "Sources:",
                    "- [Mentingo docs](https://docs.mentingo.com/onboarding)",
                    "- https://www.mentingo.com/blog/onboarding",
                    "- [Mentingo docs](https://docs.mentingo.com/onboarding)",
                  ].join("\n"),
                },
                1,
              ),
            ],
            metadata: { requestId: "request-1" },
          },
        ]}
      />,
    );

    const transcript = screen.getByTestId("course-authoring-assistant-messages");
    expect(transcript).toHaveTextContent("guided onboarding");
    expect(transcript).not.toHaveTextContent("Sources:");
    expect(transcript.querySelector('a[href^="https://"]')).toBeNull();
    const row = screen.getByTestId("authoring-source-row");
    expect(row).toHaveTextContent("Sources");
    expect(row.querySelectorAll('[data-testid="authoring-source-chip"]')).toHaveLength(2);
    expect(row).toHaveTextContent("docs.mentingo.com");
    expect(row).toHaveTextContent("mentingo.com");
    expect(screen.getAllByTestId("authoring-source-chip")).toHaveLength(3);
  });

  it("does not repeat the assistant header for trailing pending work after a reply", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-1",
                "request-1-assistant",
                { partId: "text-1", partKind: "text", status: "completed", text: "Done." },
                1,
              ),
            ],
            metadata: { requestId: "request-1" },
          },
        ]}
        pendingTasks={[{ taskId: "task-2", requestId: "request-2", phaseLabel: "Drafting" }]}
      />,
    );

    expect(screen.getAllByText("Assistant")).toHaveLength(1);
    expect(screen.getByText("Drafting")).toBeInTheDocument();
  });

  it("shows web tool failures and result counts without a raw status badge", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1-assistant",
            role: "assistant",
            parts: [
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "tool-done",
                  partKind: "tool",
                  status: "completed",
                  tool: {
                    toolCallId: "tool-done",
                    toolName: "web_search",
                    display: "Finished searching the permitted public web sources.",
                    status: "completed",
                    result: {
                      query: "OWASP agent security guidance",
                      sourceCount: 6,
                      findingCount: null,
                    },
                  },
                },
                1,
              ),
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "tool-failed",
                  partKind: "tool",
                  status: "failed",
                  tool: {
                    toolCallId: "tool-failed",
                    toolName: "lesson_generation",
                    display: "Generating lesson",
                    status: "failed",
                    result: null,
                  },
                },
                2,
              ),
            ],
            metadata: { requestId: "request-1" },
          },
        ]}
      />,
    );

    const done = screen.getByTestId("course-authoring-tool-tool-done");
    expect(done).toHaveTextContent("Searched the web");
    expect(done).toHaveTextContent("6 sources");
    expect(screen.getByRole("listitem")).toHaveTextContent("OWASP agent security guidance");
    expect(done).not.toHaveTextContent("succeeded");
    expect(screen.getByTestId("course-authoring-tool-tool-failed")).toHaveTextContent(
      /Generating lesson\s*·\s*failed/,
    );
  });

  it("renders a grouped tool only inside the request's live work", () => {
    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "request-1-assistant",
            role: "assistant",
            metadata: { requestId: "request-1" },
            parts: [
              authoringPart(
                "request-1",
                "request-1-assistant",
                {
                  partId: "tool-1",
                  partKind: "tool",
                  status: "completed",
                  tool: {
                    toolCallId: "tool-1",
                    toolName: "web_search",
                    display: "Searching",
                    status: "completed",
                    result: null,
                  },
                },
                2,
              ),
            ],
          },
        ]}
        taskActivities={[
          {
            taskId: "request-request-1",
            requestId: "request-1",
            sequence: 2,
            toolsIncluded: true,
            content: <div data-testid="grouped-live-work">Live work</div>,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("grouped-live-work")).toBeInTheDocument();
    expect(screen.queryByTestId("course-authoring-tool-tool-1")).not.toBeInTheDocument();
  });

  it("shows a failed stream and keeps the user turn available to retry", async () => {
    const onRetryChat = vi.fn();

    renderWith().render(
      <AuthoringAssistantMessages
        chatMessages={[
          {
            id: "command-1",
            role: "user",
            parts: [{ type: "text", text: "Create a safety course." }],
            metadata: { requestId: "request-1" },
          },
        ]}
        chatError={new Error("Request failed with status code 502")}
        onRetryChat={onRetryChat}
      />,
    );

    expect(screen.getByText("Create a safety course.")).toBeVisible();
    const notice = screen.getByTestId("course-authoring-chat-error");
    expect(notice).toHaveTextContent("Couldn't get a response");
    expect(notice).toHaveTextContent("temporarily unavailable");
    expect(notice).not.toHaveTextContent("status code 502");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryChat).toHaveBeenCalled();
  });
});
