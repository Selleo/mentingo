import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringActivityRail, AuthoringToolActivity } from "./AuthoringActivityRail";

import type { AssetTaskView } from "../courseAuthoring.types";

vi.mock("~/api/queries/useCourseAuthoringLinkPreviewQuery", () => ({
  useCourseAuthoringLinkPreviewQuery: () => ({ data: undefined, isLoading: false }),
}));

const assetTask: AssetTaskView = {
  taskId: "task-asset",
  parentTaskId: "task-parent",
  status: "waiting_author",
  revision: 3,
  question: "Approve another diagram submission?",
  action: "asset.retry_submission",
  ready: false,
  request: {
    assetId: "asset-1",
    operationId: "operation-1",
    purpose: "lesson",
    required: false,
    altText: "A safety diagram",
    source: { type: "generated", content: "A safety diagram", visualQuery: "safety" },
  },
};

const retryAssetTask: AssetTaskView = {
  ...assetTask,
  taskId: "task-retry",
  request: {
    ...assetTask.request,
    assetId: "asset-retry",
    operationId: "operation-retry",
    source: { type: "generated", content: "A new safety diagram", visualQuery: "safety" },
  },
  action: "asset.retry_submission",
};

describe("AuthoringActivityRail asset decisions", () => {
  it("shows web research as the only live-work step while it is running", () => {
    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[]}
        tools={[
          {
            tool: {
              toolCallId: "web-only",
              toolName: "web_search",
              display: "Searching the web",
              status: "started",
              result: null,
            },
            sequence: 1,
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Live work/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("course-authoring-tool-web-only")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 complete")).toBeInTheDocument();
  });

  it.each([
    ["route_working", "Reading your request…"],
    ["planning", "Planning your course…"],
    ["writing", "Generating your lesson…"],
    ["editing", "Updating your course…"],
    ["asset_working", "Creating a visual…"],
    ["source_working", "Searching sources…"],
    ["researching", "Searching sources…"],
    ["preparing", "Preparing your response…"],
  ])("localizes the %s task phase", (phase, label) => {
    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[
          {
            taskId: "task-phase",
            requestId: "request-phase",
            phase,
            status: "running",
            errorCode: null,
            outputId: null,
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.getByText(label)).toBeVisible();
  });

  it("shows short actions separately from execution tasks", () => {
    renderWith().render(
      <AuthoringActivityRail
        compact
        planSteps={["Research Mentingo", "Plan the outline", "Draft the lessons"]}
        tasks={[
          {
            taskId: "task-1",
            requestId: "request-1",
            kind: "plan",
            status: "running",
            errorCode: null,
            outputId: null,
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.getByText("Research Mentingo")).toBeVisible();
    expect(screen.getByText("Plan the outline")).toBeVisible();
    expect(screen.getByText("Draft the lessons")).toBeVisible();
    expect(screen.getByText("Live work")).toBeVisible();
    expect(screen.getByText("0 of 1 complete")).toBeVisible();
    expect(screen.getByText("Planning the course outline…")).toBeVisible();
  });
  it("sends the asset action with its task revision and exposes omission", async () => {
    const user = userEvent.setup();
    const onAssetAction = vi.fn();
    const onSkipAsset = vi.fn();

    renderWith().render(
      <AuthoringActivityRail
        tasks={[
          {
            taskId: "task-asset",
            requestId: "request-1",
            status: "waiting_author",
            errorCode: null,
            outputId: null,
          },
          {
            taskId: "task-retry",
            requestId: "request-1",
            status: "failed",
            errorCode: null,
            outputId: null,
          },
        ]}
        questions={[]}
        assetTasks={[assetTask, retryAssetTask]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={onAssetAction}
        onSkipAsset={onSkipAsset}
      />,
    );

    expect(screen.getAllByText(/A safety diagram/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Approve retry" })[0]);
    expect(onAssetAction).toHaveBeenCalledWith(assetTask, "asset.retry_submission");
    await user.click(screen.getAllByRole("button", { name: "Approve retry" })[1]);
    expect(onAssetAction).toHaveBeenCalledWith(retryAssetTask, "asset.retry_submission");
    await user.click(screen.getAllByRole("button", { name: "Skip optional asset" })[0]);
    expect(onSkipAsset).toHaveBeenCalledWith("asset-1");
  });

  it("keeps the running task stop action compact and request-scoped", async () => {
    const user = userEvent.setup();
    const onStopRequest = vi.fn();

    renderWith().render(
      <AuthoringActivityRail
        tasks={[
          {
            taskId: "task-running",
            requestId: "request-running",
            status: "running",
            errorCode: null,
            outputId: null,
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={onStopRequest}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    const stop = screen.getByRole("button", { name: "Stop request" });
    expect(stop).toHaveClass("size-7");
    expect(stop).not.toHaveTextContent("Stop request");
    await user.click(stop);
    expect(onStopRequest).toHaveBeenCalledWith("request-running");
  });

  it("discards a request waiting for author input", async () => {
    const user = userEvent.setup();
    const onDiscardRequest = vi.fn();

    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[
          {
            taskId: "task-waiting",
            requestId: "request-waiting",
            status: "waiting_author",
            errorCode: null,
            outputId: null,
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onDiscardRequest={onDiscardRequest}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Discard request" }));
    expect(onDiscardRequest).toHaveBeenCalledWith("request-waiting");
  });

  it("uses meaningful inline compact activity rows without dashboard chrome", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onStopRequest = vi.fn();

    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[
          {
            taskId: "task-research",
            requestId: "request-research",
            kind: "research",
            status: "running",
            errorCode: null,
            outputId: null,
          },
          {
            taskId: "task-edit",
            requestId: "request-edit",
            kind: "edit",
            status: "failed",
            errorCode: "task_execution_failed",
            outputId: null,
          },
          {
            taskId: "task-lesson",
            requestId: "request-lesson",
            kind: "lesson",
            status: "succeeded",
            errorCode: null,
            outputId: null,
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={onRetry}
        onStopRequest={onStopRequest}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.getByText("Searching sources…")).toBeVisible();
    expect(screen.getByText("Updating your course…")).toBeVisible();
    expect(
      screen.getByText(
        "The course-generation step could not finish. Retry it or change your instructions.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("task_execution_failed")).toBeNull();
    expect(screen.getByText("Live work")).toBeVisible();
    expect(screen.queryByText("live")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("succeeded")).toBeNull();
    expect(screen.getByText("1 of 1 lessons complete")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Stop request" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onStopRequest).toHaveBeenCalledWith("request-research");
    expect(onRetry).toHaveBeenCalledWith("task-edit");
  });

  it("does not expose usage or pricing in the authoring interface", () => {
    renderWith().render(
      <AuthoringActivityRail
        tasks={[]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.queryByText(/usage|tokens|USD|invocations/i)).toBeNull();
  });
});

describe("AuthoringActivityRail live work", () => {
  const compactRail = (status: "running" | "succeeded") => (
    <AuthoringActivityRail
      compact
      tasks={[
        {
          taskId: "task-1",
          requestId: "request-1",
          kind: "plan",
          phase: "generating_lesson",
          status,
          errorCode: null,
          outputId: null,
        },
      ]}
      questions={[]}
      assetTasks={[]}
      applications={[]}
      connection="live"
      onRetry={vi.fn()}
      onStopRequest={vi.fn()}
      onAnswer={vi.fn()}
      onAssetAction={vi.fn()}
      onSkipAsset={vi.fn()}
    />
  );

  it("labels direct page extraction separately from search and shows its URL", () => {
    renderWith().render(
      <AuthoringToolActivity
        tool={{
          toolCallId: "read-link",
          toolName: "web_extract",
          display: "https://owasp.org/",
          status: "completed",
          result: { query: "https://owasp.org/", sourceCount: 1 },
        }}
      />,
    );
    expect(screen.getByText("Read linked page")).toBeVisible();
    expect(screen.getByText("https://owasp.org/")).toBeVisible();
    expect(screen.queryByText("Searched the web")).toBeNull();
  });

  it("shows fetched source citations and excludes unsafe or duplicate URLs", () => {
    renderWith().render(
      <AuthoringToolActivity
        tool={{
          toolCallId: "fetched-sources",
          toolName: "web_extract",
          display: "Read page",
          status: "completed",
          result: {
            sources: [
              { url: "https://example.com/docs", title: "Platform documentation" },
              { url: "https://example.com/docs", title: "Duplicate" },
              { url: "javascript:alert(1)", title: "Unsafe" },
            ],
          },
        }}
      />,
    );
    expect(screen.getAllByTestId("authoring-source-chip")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Platform documentation/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Unsafe|Duplicate/ })).toBeNull();
  });

  it.each([
    ["started", "Synthesizing saved sources"],
    ["completed", "Source synthesis complete"],
    ["failed", "Source synthesis failed"],
    ["stopped", "Source synthesis stopped"],
  ] as const)("renders local synthesis separately from searches: %s", (status, label) => {
    renderWith().render(
      <AuthoringToolActivity
        tool={{
          toolCallId: "local-synthesis",
          toolName: "research_synthesis",
          display: "3/9",
          status,
          result: { query: "This is not an external search query" },
        }}
      />,
    );
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText("3/9")).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("This is not an external search query")).toBeNull();
    const activity = screen.getByTestId("course-authoring-tool-local-synthesis");
    expect(activity.querySelector(".animate-spin")).toBeNull();
    expect(activity.querySelector(".motion-safe\\:animate-spin") !== null).toBe(
      status === "started",
    );
  });

  it("shows exact search queries beneath the individual tool row", () => {
    renderWith().render(
      <AuthoringToolActivity
        tool={{
          toolCallId: "chat-search",
          toolName: "web_search",
          display: "Searched the web",
          status: "completed",
          result: { query: "A detailed search query" },
        }}
      />,
    );

    expect(screen.getByText("Searched the web")).toBeVisible();
    expect(screen.getByRole("listitem")).toHaveTextContent("A detailed search query");
  });

  it("groups completed web searches and keeps exact query history visible", () => {
    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[]}
        tools={[
          {
            taskId: "research-task",
            sequence: 1,
            tool: {
              toolCallId: "search-one",
              toolName: "web_search",
              display: "First web search",
              status: "completed",
              result: {
                query: "Mentingo authoring workflow: first query?",
                sourceCount: 2,
                sources: [{ url: "https://example.com/docs", title: "Fetched documentation" }],
              },
            },
          },
          {
            taskId: "research-task",
            sequence: 2,
            tool: {
              toolCallId: "search-two",
              toolName: "web_search",
              display: "Second web search",
              status: "completed",
              result: {
                query: "Mentingo authoring workflow: second query?",
                queries: ["Earlier saved query", "Mentingo authoring workflow: first query?"],
                sourceCount: 3,
                sources: [
                  { url: "https://example.com/docs", title: "Fetched documentation" },
                  { url: "https://example.org/manual", title: "Manual" },
                ],
              },
            },
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Live work/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getAllByText("Searched the web")).toHaveLength(1);
    expect(screen.getAllByTestId("authoring-source-chip")).toHaveLength(2);
    expect(
      within(screen.getByRole("list", { name: "Search queries" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Mentingo authoring workflow: first query?",
      "Mentingo authoring workflow: second query?",
      "Earlier saved query",
    ]);
  });

  it("keeps queries after the first twelve inspectable from the grouped activity", async () => {
    const user = userEvent.setup();
    const queries = Array.from({ length: 13 }, (_, index) => `search query ${index + 1}`);
    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[]}
        tools={[
          {
            taskId: "research-task",
            sequence: 1,
            tool: {
              toolCallId: "search-many",
              toolName: "web_search",
              display: "Searched the web",
              status: "completed",
              result: { queries },
            },
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.getByText("search query 12")).toBeVisible();
    expect(screen.getByText("search query 13")).not.toBeVisible();
    await user.click(screen.getByText("+1 more queries"));
    expect(screen.getByText("search query 13")).toBeVisible();
  });

  it("stays open while work runs and collapses once it is done", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWith().render(compactRail("running"));
    expect(screen.getByRole("button", { name: /Live work/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Planning the course outline…")).toBeVisible();

    rerender(compactRail("succeeded"));
    const toggle = screen.getByRole("button", { name: /Live work/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("1 of 1 complete")).toBeVisible();
    expect(screen.queryByText("Planning the course outline…")).toBeNull();

    await user.click(toggle);
    expect(screen.getByText("Planning the course outline…")).toBeVisible();
  });

  it("shows chapter planning rows and treats a succeeded planner as complete", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[
          {
            taskId: "task-detailed-plan",
            requestId: "request-plan",
            kind: "detailed_plan",
            status: "succeeded",
            errorCode: null,
            outputId: null,
            workProgress: {
              stage: "validation",
              chapters: [
                { chapterId: "chapter-1", title: "Foundations", lessonCount: 3, status: "running" },
                { chapterId: "chapter-2", title: "Practice", lessonCount: 2, status: "pending" },
              ],
              completedLessons: 0,
              totalLessons: 5,
            },
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Live work/ }));
    expect(screen.getByText(/2 of 2 chapters planned/)).toBeVisible();
    expect(screen.getByText("Foundations")).toBeVisible();
    expect(screen.getByText("Practice")).toBeVisible();
    expect(screen.getByText("3 lessons")).toBeVisible();
    expect(screen.getByText("2 lessons")).toBeVisible();
    expect(screen.getAllByText("planned")).toHaveLength(2);
    expect(screen.queryByText("in progress")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Live work/ })).toHaveLength(1);
    expect(screen.queryByText("task-detailed-plan")).toBeNull();
  });

  it("groups lesson tasks by chapter and keeps current lesson and request actions visible", async () => {
    const user = userEvent.setup();
    const onStopRequest = vi.fn();
    const chapterProgress = {
      stage: "lesson_generation" as const,
      chapterId: "chapter-1",
      chapterTitle: "Foundations",
    };

    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={[
          {
            taskId: "lesson-complete",
            requestId: "request-lessons",
            kind: "lesson",
            status: "succeeded",
            errorCode: null,
            outputId: null,
            workProgress: {
              ...chapterProgress,
              lessonId: "lesson-1",
              lessonTitle: "Welcome",
            },
          },
          {
            taskId: "lesson-running",
            requestId: "request-lessons",
            kind: "lesson",
            status: "running",
            errorCode: null,
            outputId: null,
            workProgress: {
              ...chapterProgress,
              lessonId: "lesson-2",
              lessonTitle: "Practice the basics",
            },
          },
        ]}
        tools={[
          {
            taskId: "lesson-running",
            sequence: 3,
            tool: {
              toolCallId: "lesson-search",
              toolName: "web_search",
              display: "Searching lesson sources",
              status: "started",
              result: null,
            },
          },
          {
            taskId: "lesson-complete",
            sequence: 4,
            tool: {
              toolCallId: "lesson-research-done",
              toolName: "research",
              display: "Research complete",
              status: "completed",
              result: { query: "Foundations lesson research" },
            },
          },
        ]}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={onStopRequest}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    expect(screen.getByText("Foundations")).toBeVisible();
    expect(screen.getByText("1 of 2 lessons complete in this chapter")).toBeVisible();
    expect(screen.getByText("Practice the basics")).toBeVisible();
    expect(screen.getByTestId("course-authoring-tool-lesson-search")).toBeVisible();
    expect(screen.getByText("Foundations lesson research")).toBeVisible();
    expect(screen.getByText("Research steps complete: 1")).toBeVisible();
    expect(screen.queryByText("Generating your lesson…")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Live work/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Stop request" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Stop request" }));
    expect(onStopRequest).toHaveBeenCalledWith("request-lessons");
  });

  it("limits running lesson titles per chapter while keeping the remainder count", async () => {
    const user = userEvent.setup();
    const tasks = Array.from({ length: 20 }, (_, index) => ({
      taskId: `lesson-${index + 1}`,
      requestId: "request-many-lessons",
      kind: "lesson",
      status: "running" as const,
      errorCode: null,
      outputId: null,
      workProgress: {
        stage: "lesson_generation" as const,
        lessonId: `lesson-id-${index + 1}`,
        lessonTitle: `Lesson ${index + 1}`,
        chapterId: "chapter-large",
        chapterTitle: "Large chapter",
      },
    }));

    renderWith().render(
      <AuthoringActivityRail
        compact
        tasks={tasks}
        questions={[]}
        assetTasks={[]}
        applications={[]}
        connection="live"
        onRetry={vi.fn()}
        onStopRequest={vi.fn()}
        onAnswer={vi.fn()}
        onAssetAction={vi.fn()}
        onSkipAsset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Live work/ }));
    expect(screen.getByText("Lesson 1")).toBeVisible();
    expect(screen.getByText("Lesson 2")).toBeVisible();
    expect(screen.getByText("Lesson 3")).toBeVisible();
    expect(screen.queryByText("Lesson 4")).toBeNull();
    expect(screen.getByText("+17 more lessons running")).toBeVisible();
  });
});

describe("AuthoringActivityRail recovery", () => {
  it.each([true, false])(
    "hides ineffective retries and offers failed-part recovery (compact=%s)",
    async (compact) => {
      const onRetry = vi.fn();
      const failure = {
        code: "planning_batch_invalid",
        category: "generation" as const,
        stage: "generate",
        recoveryAction: "retry_failed_parts" as const,
        retryable: true,
        affectedChapterIds: ["chapter-1"],
        affectedLessonIds: [],
        correlationId: null,
        detailKey: null,
        generationRevision: 0,
      };
      renderWith().render(
        <AuthoringActivityRail
          compact={compact}
          tasks={[
            {
              taskId: "failed-plan",
              requestId: "request-1",
              kind: "detailed_plan",
              status: "failed",
              errorCode: failure.code,
              outputId: null,
              failure,
            },
            {
              taskId: "broken-service",
              requestId: "request-2",
              kind: "edit",
              status: "failed",
              errorCode: "internal",
              outputId: null,
              failure: {
                ...failure,
                category: "internal",
                recoveryAction: "service_fix",
                retryable: false,
              },
            },
          ]}
          questions={[]}
          assetTasks={[]}
          applications={[]}
          connection="live"
          onRetry={onRetry}
          onStopRequest={vi.fn()}
          onAnswer={vi.fn()}
          onAssetAction={vi.fn()}
          onSkipAsset={vi.fn()}
        />,
      );
      expect(
        screen.getByText(
          "This step requires a service fix. Your completed work is saved; retrying cannot resolve this issue.",
        ),
      ).toBeVisible();
      expect(screen.getAllByRole("button", { name: "Retry failed parts" })).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      await userEvent.setup().click(screen.getByRole("button", { name: "Retry failed parts" }));
      expect(onRetry).toHaveBeenCalledWith("failed-plan");
    },
  );
});
