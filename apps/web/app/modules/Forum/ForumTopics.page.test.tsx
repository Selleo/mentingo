import { createRemixStub } from "@remix-run/testing";
import { DISCUSSION_SCOPES, PERMISSIONS } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { renderWith } from "~/utils/testUtils";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import ForumTopicsPage from "./ForumTopics.page";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      settingsControllerGetPublicGlobalSettings: vi.fn(),
      courseControllerGetStudentCourses: vi.fn(),
      forumControllerGetTopics: vi.fn(),
    },
  },
}));

vi.mock("~/api/queries/useCurrentUser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/api/queries/useCurrentUser")>()),
  useCurrentUser: () => ({
    data: { id: "user-1", permissions: [PERMISSIONS.COURSE_DISCUSSION_READ] },
  }),
}));

type TopicsQuery = NonNullable<Parameters<typeof ApiClient.api.forumControllerGetTopics>[0]>;

const COURSE_ID = "course-1";
const TOPIC_TITLE = "Onboarding tips";

const topic = {
  id: "topic-1",
  scope: DISCUSSION_SCOPES.GENERAL,
  title: TOPIC_TITLE,
  course: null,
  author: { id: "user-2", firstName: "Ada", lastName: "Author", avatarReference: null },
  replyCount: 0,
  lastActivityAt: "2026-11-01T10:00:00.000Z",
  createdAt: "2026-11-01T10:00:00.000Z",
  excerpt: "Start here",
  isDeleted: false,
};

const mockSettings = (forumEnabled: boolean) =>
  vi.mocked(ApiClient.api.settingsControllerGetPublicGlobalSettings).mockResolvedValue({
    data: { data: { forumEnabled, courseDiscussionsEnabled: true } },
  } as never);

const mockTopics = (
  resolveTopics: (query: TopicsQuery) => { data: unknown[]; totalItems: number },
) =>
  vi.mocked(ApiClient.api.forumControllerGetTopics).mockImplementation((async (
    query: TopicsQuery,
  ) => {
    const { data, totalItems } = resolveTopics(query);

    return { data: { data, pagination: { totalItems, page: query.page, perPage: query.perPage } } };
  }) as never);

const renderForum = (url: string) => {
  const RemixStub = createRemixStub([
    { path: "/forum", Component: ForumTopicsPage },
    { path: "/", Component: () => <p>home page</p> },
  ]);

  return renderWith().render(
    <QueryClientProvider client={queryClient}>
      <RemixStub initialEntries={[url]} />
    </QueryClientProvider>,
  );
};

const lastTopicsQuery = () => vi.mocked(ApiClient.api.forumControllerGetTopics).mock.lastCall?.[0];

describe("ForumTopicsPage", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    mockSettings(true);
    vi.mocked(ApiClient.api.courseControllerGetStudentCourses).mockResolvedValue({
      data: { data: [{ id: COURSE_ID, title: "Sales" }] },
    } as never);
    mockTopics(() => ({ data: [topic], totalItems: 1 }));
  });

  it("shows all topics when the filter in the URL is not one of the viewer's courses", async () => {
    renderForum("/forum?filter=foo");

    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    expect(lastTopicsQuery()).not.toHaveProperty("courseId");
    expect(lastTopicsQuery()).not.toHaveProperty("scope");
  });

  it("filters by a course the viewer is enrolled in", async () => {
    renderForum(`/forum?filter=${COURSE_ID}`);

    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    expect(lastTopicsQuery()).toMatchObject({
      scope: DISCUSSION_SCOPES.COURSE,
      courseId: COURSE_ID,
    });
  });

  it("returns to the last existing page when the requested page is gone", async () => {
    mockTopics((query) =>
      query.page === 1 ? { data: [topic], totalItems: 20 } : { data: [], totalItems: 20 },
    );

    renderForum("/forum?page=2");

    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    expect(lastTopicsQuery()).toMatchObject({ page: 1 });
    expect(screen.queryByTestId(FORUM_HANDLES.EMPTY_STATE)).not.toBeInTheDocument();
  });

  it("redirects away without loading topics while the forum is disabled", async () => {
    mockSettings(false);

    renderForum("/forum");

    expect(await screen.findByText("home page")).toBeInTheDocument();
    await waitFor(() => expect(ApiClient.api.forumControllerGetTopics).not.toHaveBeenCalled());
  });
});
