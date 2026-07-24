import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseSettingsDrawer from "./CourseSettingsDrawer";

vi.mock("~/modules/Admin/EditCourse/CourseSettings/components/CourseSettingsSwitches", () => ({
  CourseSettingsSwitches: () => <div>Course settings switches</div>,
}));

describe("CourseSettingsDrawer", () => {
  it("uses dialog semantics and closes through the Sheet API", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWith().render(
      <CourseSettingsDrawer
        courseId="course-id"
        onOpenChange={onOpenChange}
        open
        title="Course settings"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Course settings" })).toBeInTheDocument();
    expect(screen.getByText("Course settings switches")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
