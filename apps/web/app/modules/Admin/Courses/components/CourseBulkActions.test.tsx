import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { COURSES_PAGE_HANDLES } from "../../../../../e2e/data/courses/handles";

import { CourseBulkActions } from "./CourseBulkActions";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("~/api/mutations/admin/useBulkArchiveCourse", () => ({
  useBulkArchiveCourse: () => ({ mutateAsync: mocks.archive, isPending: false }),
}));
vi.mock("~/api/mutations/admin/useBulkUpdateCourseCategory", () => ({
  useBulkUpdateCourseCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("~/api/mutations/admin/useBulkUpdateCourseStatus", () => ({
  useBulkUpdateCourseStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("~/api/mutations/admin/useDeleteCourse", () => ({
  useDeleteCourse: () => ({ mutate: vi.fn() }),
}));
vi.mock("~/api/mutations/admin/useDeleteManyCourses", () => ({
  useDeleteManyCourses: () => ({ mutate: vi.fn() }),
}));

const renderActions = (selectedArchivedStates: boolean[]) =>
  renderWith().render(
    <CourseBulkActions
      selectedCourseIds={selectedArchivedStates.map((_, index) => `course-${index + 1}`)}
      selectedArchivedStates={selectedArchivedStates}
      categories={[]}
      onBulkActionComplete={mocks.complete}
    />,
  );

describe("CourseBulkActions archive actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.mockResolvedValue(undefined);
  });

  it("offers archive without restore when every selected course is active", async () => {
    const user = userEvent.setup();
    renderActions([false]);

    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER));
    expect(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION)).toBeInTheDocument();
    expect(
      screen.queryByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION),
    ).not.toBeInTheDocument();
  });

  it("offers archive for active or mixed selections and confirms all selected ids", async () => {
    const user = userEvent.setup();
    renderActions([false, true]);

    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER));
    expect(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION)).toBeInTheDocument();
    expect(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION)).toBeInTheDocument();
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION));

    expect(screen.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG)).toBeInTheDocument();
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CANCEL_BUTTON));
    expect(mocks.archive).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER));
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION));
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON));

    expect(mocks.archive).toHaveBeenCalledWith({ ids: ["course-1", "course-2"], isArchived: true });
    expect(mocks.complete).toHaveBeenCalledOnce();

    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER));
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION));
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON));

    expect(mocks.archive).toHaveBeenLastCalledWith({
      ids: ["course-1", "course-2"],
      isArchived: false,
    });
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });

  it("offers restore without archive when every selected course is archived", async () => {
    const user = userEvent.setup();
    renderActions([true, true]);

    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER));
    expect(
      screen.queryByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION),
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION));
    await user.click(screen.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON));

    expect(mocks.archive).toHaveBeenCalledWith({
      ids: ["course-1", "course-2"],
      isArchived: false,
    });
    expect(mocks.complete).toHaveBeenCalledOnce();
  });
});
