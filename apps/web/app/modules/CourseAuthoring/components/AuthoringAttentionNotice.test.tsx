import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringAttentionNotice } from "./AuthoringAttentionNotice";

import type { AuthoringConnectionState, AuthoringSession } from "../courseAuthoring.types";

const mocks = vi.hoisted(() => ({
  session: undefined as AuthoringSession | undefined,
  connection: "live" as AuthoringConnectionState,
  socket: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: mocks.session })),
  };
});

vi.mock("~/api/queries/useCourseAuthoringSessionQuery", () => ({
  authoringSessionKey: vi.fn((courseId: string, language: string) => [
    "course-authoring",
    courseId,
    language,
  ]),
  authoringSessionQueryOptions: vi.fn(() => ({
    queryKey: ["course-authoring"],
    queryFn: vi.fn(),
  })),
  refreshAuthoringSession: mocks.refresh,
}));

vi.mock("../hooks/useCourseAuthoringSocket", () => ({
  useCourseAuthoringSocket: mocks.socket.mockImplementation(() => mocks.connection),
}));

const waitingSession = (): AuthoringSession => ({
  schemaVersion: 1,
  sessionId: "session-1",
  courseId: "course-1",
  language: "en",
  status: "active",
  snapshotSequence: 4,
  workspaceRevision: 4,
  records: [
    {
      id: "question-1",
      kind: "question",
      payload: {
        taskId: "task-1",
        revision: 2,
        question: "Which source should support this lesson?",
      },
    },
  ],
  tasks: [
    {
      taskId: "task-1",
      requestId: "request-1",
      status: "waiting_author",
      errorCode: null,
      outputId: null,
    },
  ],
});

const renderNotice = (onOpen = vi.fn()) =>
  renderWith().render(
    <AuthoringAttentionNotice courseId="course-1" language="en" onOpen={onOpen} />,
  );

describe("AuthoringAttentionNotice", () => {
  beforeEach(() => {
    mocks.session = undefined;
    mocks.connection = "live";
    mocks.socket.mockClear();
    mocks.refresh.mockClear();
  });

  it("does not create or open a session when no cached session exists", () => {
    const onOpen = vi.fn();

    renderNotice(onOpen);

    expect(screen.queryByRole("button")).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    expect(mocks.socket).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "course-1", session: undefined }),
    );
  });

  it("notifies the editor when an existing session needs author input", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    mocks.session = waitingSession();

    renderNotice(onOpen);

    const notice = screen.getByRole("button", { name: "Needs your input" });
    expect(notice).toBeVisible();
    await user.click(notice);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("hides cached attention after the socket reports access is offline", () => {
    mocks.session = waitingSession();
    mocks.connection = "offline";

    renderNotice();

    expect(screen.queryByRole("button", { name: "Needs your input" })).toBeNull();
  });

  it("does not refresh by polling or issue navigation and stop actions", () => {
    mocks.session = waitingSession();

    renderNotice();

    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
  });
});
