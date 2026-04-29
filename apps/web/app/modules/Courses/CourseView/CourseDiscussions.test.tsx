import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseDiscussions } from "./CourseDiscussions";

const mockUseDiscussions = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseDiscussionDetail = vi.fn();
const mockCreateThreadMutate = vi.fn();
const mockCreateCommentMutate = vi.fn();

vi.mock("~/api/queries/useDiscussions", () => ({
  useDiscussions: (...args: unknown[]) => mockUseDiscussions(...args),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("~/api/mutations/useDiscussions", () => ({
  useDiscussionDetail: (...args: unknown[]) => mockUseDiscussionDetail(...args),
  useCreateThread: () => ({ mutate: mockCreateThreadMutate, isPending: false }),
  useUpdateThread: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteThread: () => ({ mutate: vi.fn(), isPending: false }),
  useModerateThread: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateComment: () => ({ mutate: mockCreateCommentMutate, isPending: false }),
  useUpdateComment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteComment: () => ({ mutate: vi.fn(), isPending: false }),
  useModerateComment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("~/components/RichText/Editor", () => ({
  ContentEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={placeholder ?? "editor"}
      placeholder={placeholder}
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const threadFixture = {
  id: "thread-1",
  courseId: "course-1",
  lessonId: null,
  authorId: "user-1",
  title: "Test Thread",
  content: "<p>Test content</p>",
  status: "visible" as const,
  lastActivityAt: "2024-01-01",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

describe("CourseDiscussions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({ data: { id: "user-1", roleSlugs: [] } });
    mockUseDiscussionDetail.mockReturnValue({ data: null, isLoading: false });
  });

  it("renders empty state when API returns no threads", () => {
    mockUseDiscussions.mockReturnValue({ data: [], isLoading: false });

    renderWith().render(<CourseDiscussions courseId="course-1" courseAuthorId="author-1" />);

    expect(screen.getByTestId("discussions-empty")).toBeInTheDocument();
  });

  it("passes lessonId to scoped discussions query", () => {
    mockUseDiscussions.mockReturnValue({ data: [], isLoading: false });

    renderWith().render(
      <CourseDiscussions courseId="course-1" courseAuthorId="author-1" lessonId="lesson-1" />,
    );

    expect(mockUseDiscussions).toHaveBeenCalledWith("course-1", "lesson-1");
  });

  it("passes lessonId to create thread mutation", async () => {
    const user = userEvent.setup();
    mockUseDiscussions.mockReturnValue({ data: [], isLoading: false });

    renderWith().render(
      <CourseDiscussions courseId="course-1" courseAuthorId="author-1" lessonId="lesson-1" />,
    );

    // Click create button to show form
    await user.click(screen.getByText(/createFirstThread/i));

    // Fill in title
    await user.type(screen.getByTestId("create-thread-title"), "New Thread");

    // Fill in content via ContentEditor (mocked as textarea)
    const contentArea = document.querySelector(
      'textarea[aria-label*="contentPlaceholder"]',
    ) as HTMLTextAreaElement;
    await user.type(contentArea!, "Thread content here");

    // Submit the form
    await user.click(screen.getByRole("button", { name: /createThread/i }));

    // Get the actual call arguments
    const callArgs = mockCreateThreadMutate.mock.calls[0];

    // Verify first argument contains expected values
    expect(callArgs[0]).toMatchObject({
      courseId: "course-1",
      lessonId: "lesson-1",
    });
    expect(callArgs[0].data).toMatchObject({ title: "New Thread" });
  });

  it("shows create button and thread list when threads exist", () => {
    mockUseDiscussions.mockReturnValue({ data: [threadFixture], isLoading: false });

    renderWith().render(<CourseDiscussions courseId="course-1" courseAuthorId="author-1" />);

    expect(screen.getByText(/createThread/i)).toBeInTheDocument();
    expect(screen.getByText("Test Thread")).toBeInTheDocument();
  });

  it("opens thread detail when thread is clicked", async () => {
    const user = userEvent.setup();

    mockUseDiscussionDetail.mockReturnValue({
      data: { ...threadFixture, comments: [] },
      isLoading: false,
    });
    mockUseDiscussions.mockReturnValue({ data: [threadFixture], isLoading: false });

    renderWith().render(<CourseDiscussions courseId="course-1" courseAuthorId="author-1" />);

    await user.click(screen.getByText("Test Thread"));

    expect(screen.getByText(/backToThreads/i)).toBeInTheDocument();
  });

  it("shows author edit/delete buttons when current user is author", async () => {
    const user = userEvent.setup();

    mockUseDiscussionDetail.mockReturnValue({
      data: { ...threadFixture, comments: [] },
      isLoading: false,
    });
    mockUseDiscussions.mockReturnValue({ data: [threadFixture], isLoading: false });

    renderWith().render(<CourseDiscussions courseId="course-1" courseAuthorId="user-1" />);

    await user.click(screen.getByText("Test Thread"));

    // Check for edit and delete buttons for author
    expect(screen.getByRole("button", { name: /common.edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /common.delete/i })).toBeInTheDocument();
  });

  it("shows hide button when current user is admin", async () => {
    const user = userEvent.setup();

    mockUseCurrentUser.mockReturnValue({ data: { id: "admin-1", roleSlugs: ["admin"] } });
    mockUseDiscussionDetail.mockReturnValue({
      data: { ...threadFixture, comments: [] },
      isLoading: false,
    });
    mockUseDiscussions.mockReturnValue({ data: [threadFixture], isLoading: false });

    renderWith().render(<CourseDiscussions courseId="course-1" courseAuthorId="author-1" />);

    await user.click(screen.getByText("Test Thread"));

    // Check for hide button
    expect(screen.getAllByText(/common.hide/i).length).toBeGreaterThan(0);
  });

  it("shows placeholder text for hidden threads", () => {
    mockUseDiscussions.mockReturnValue({
      data: [{ ...threadFixture, status: "hidden_by_staff" as const }],
      isLoading: false,
    });

    renderWith().render(<CourseDiscussions courseId="course-1" courseAuthorId="author-1" />);

    expect(screen.getByText(/hidden_by_staff/i)).toBeInTheDocument();
  });
});
