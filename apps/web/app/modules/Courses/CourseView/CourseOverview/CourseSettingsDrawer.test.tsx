import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseSettingsDrawer from "./CourseSettingsDrawer";

vi.mock("~/modules/Admin/EditCourse/CourseSettings/components/CourseSettingsSwitches", () => ({
  CourseSettingsSwitches: () => <div>Course settings switches</div>,
}));

vi.mock("~/modules/Admin/EditCourse/hooks/useEditCourseTabs", () => ({
  useEditCourseTabs: () => [{ label: "Status", value: "status" }],
}));

describe("CourseSettingsDrawer", () => {
  it("uses dialog semantics and closes through the Sheet API", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWith({ withQuery: true }).render(
      <CourseSettingsDrawer
        courseId="course-id"
        isArchived={false}
        language="en"
        isSharedCourse={false}
        onOpenChange={onOpenChange}
        open
        status="draft"
        title="Course settings"
        unsupportedLessonCount={0}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Course settings" })).toBeInTheDocument();
    expect(screen.getByText("Course settings switches")).toBeInTheDocument();
    expect(screen.queryByTestId("course-settings-archive-action-button")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("course-overview-settings-tab-status"));
    await user.click(screen.getByTestId("course-settings-archive-action-button"));
    expect(screen.getByTestId("course-settings-archive-confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("course-settings-archive-cancel-button"));

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers archive management alongside shared course status", () => {
    renderWith({ withQuery: true }).render(
      <CourseSettingsDrawer
        courseId="course-id"
        isArchived={false}
        isSharedCourse
        language="en"
        onOpenChange={vi.fn()}
        open
        status="draft"
        title="Course settings"
        unsupportedLessonCount={0}
      />,
    );

    expect(screen.getByTestId("course-overview-settings-tab-status")).toBeInTheDocument();
    expect(screen.queryByText("Course settings switches")).not.toBeInTheDocument();
    expect(screen.getByTestId("course-settings-archive-action-button")).toBeInTheDocument();
  });
});
