import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseArchiveSetting from "./CourseArchiveSetting";

const mocks = vi.hoisted(() => ({
  updateArchiveState: vi.fn(),
  isPending: false,
}));

vi.mock("~/api/mutations/admin/useBulkArchiveCourse", () => ({
  useBulkArchiveCourse: () => ({ mutate: mocks.updateArchiveState, isPending: mocks.isPending }),
}));

describe("CourseArchiveSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPending = false;
  });

  it("requires confirmation before archiving", async () => {
    const user = userEvent.setup();
    renderWith().render(<CourseArchiveSetting courseId="course-id" isArchived={false} />);

    const archiveAction = screen.getByTestId("course-settings-archive-action-button");
    expect(screen.getByRole("heading", { name: "Course availability" })).toBeInTheDocument();
    expect(screen.getByText("Archive course")).toBeInTheDocument();
    await user.click(archiveAction);

    expect(mocks.updateArchiveState).not.toHaveBeenCalled();
    expect(screen.getByTestId("course-settings-archive-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Archive" })).toBeInTheDocument();

    await user.click(screen.getByTestId("course-settings-archive-cancel-button"));
    expect(mocks.updateArchiveState).not.toHaveBeenCalled();

    await user.click(archiveAction);
    await user.click(screen.getByTestId("course-settings-archive-confirm-button"));
    expect(mocks.updateArchiveState).toHaveBeenCalledWith(
      { ids: ["course-id"], isArchived: true },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("restores an archived course directly", async () => {
    const user = userEvent.setup();
    renderWith().render(<CourseArchiveSetting courseId="course-id" isArchived />);

    expect(screen.getByText("Course archived")).toBeInTheDocument();
    await user.click(screen.getByTestId("course-settings-archive-action-button"));

    expect(mocks.updateArchiveState).toHaveBeenCalledWith({
      ids: ["course-id"],
      isArchived: false,
    });
    expect(screen.queryByTestId("course-settings-archive-confirm-dialog")).not.toBeInTheDocument();
  });

  it("disables archive controls and keeps confirmation open while the request is pending", async () => {
    const user = userEvent.setup();
    const view = renderWith().render(
      <CourseArchiveSetting courseId="course-id" isArchived={false} />,
    );

    await user.click(screen.getByTestId("course-settings-archive-action-button"));
    mocks.isPending = true;
    view.rerender(<CourseArchiveSetting courseId="course-id" isArchived={false} />);

    expect(screen.getByTestId("course-settings-archive-action-button")).toBeDisabled();
    expect(screen.getByTestId("course-settings-archive-confirm-button")).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("course-settings-archive-confirm-dialog")).toBeInTheDocument();
  });
});
