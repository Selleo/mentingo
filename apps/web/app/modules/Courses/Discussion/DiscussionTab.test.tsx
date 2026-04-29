import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { DiscussionTab } from "./DiscussionTab";

vi.mock("~/api/queries", async () => {
  return {
    useCurrentUser: () => ({
      data: { id: "current-user-id", permissions: [] },
    }),
    useCurrentUserSuspense: () => ({
      data: { id: "current-user-id", permissions: [] },
    }),
  };
});

const createMutateAsync = vi.fn();
const fetchNextPage = vi.fn();

vi.mock("./api", async () => {
  return {
    useCourseComments: () => ({
      data: {
        pages: [
          {
            data: {
              data: [
                {
                  id: "c1",
                  courseId: "course-1",
                  parentCommentId: null,
                  content: "Hello world",
                  isDeleted: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  replyCount: 0,
                  author: {
                    id: "u1",
                    firstName: "Alice",
                    lastName: "Smith",
                    profilePictureUrl: null,
                  },
                  replies: [],
                },
              ],
              nextCursor: null,
            },
          },
        ],
      },
      isLoading: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage,
    }),
    useCourseCommentReplies: () => ({
      data: { pages: [] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage,
    }),
    useCreateCourseComment: () => ({
      mutate: createMutateAsync,
      mutateAsync: createMutateAsync,
      isPending: false,
    }),
    useDeleteCourseComment: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useUpdateCourseComment: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

describe("DiscussionTab", () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    createMutateAsync.mockResolvedValue({});
  });

  it("renders existing comment and submits a new one", async () => {
    renderWith({ withQuery: true }).render(
      <DiscussionTab courseId="course-1" courseAuthorId={null} />,
    );

    expect(await screen.findByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/cohort/i);
    await userEvent.type(textarea, "My new comment");
    const submit = screen.getByRole("button", { name: /post/i });
    expect(submit).not.toBeDisabled();
    await userEvent.click(submit);

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({ content: "My new comment" });
    });
  });
});
