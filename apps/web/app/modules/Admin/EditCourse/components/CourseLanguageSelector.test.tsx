import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import {
  COURSE_LANGUAGE_DIALOG_HANDLES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../../../../../e2e/data/courses/handles";

import { CourseLanguageSelector } from "./CourseLanguageSelector";

const mocks = vi.hoisted(() => ({
  deleteLanguage: vi.fn(),
}));

vi.mock("~/api/mutations/admin/useDeleteCourseLanguage", () => ({
  useDeleteCourseLanguage: () => ({ mutateAsync: mocks.deleteLanguage }),
}));

describe("CourseLanguageSelector", () => {
  it("returns to the base language after deleting the active translation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mocks.deleteLanguage.mockResolvedValue(undefined);

    renderWith().render(
      <CourseLanguageSelector
        courseLanguage="pl"
        course={{
          id: "course-1",
          baseLanguage: "en",
          availableLocales: ["en", "pl"],
        }}
        isAIConfigured={false}
        onChange={onChange}
        setOpenGenerateTranslationModal={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId(EDIT_COURSE_PAGE_HANDLES.DELETE_LANGUAGE_BUTTON));
    await user.click(screen.getByTestId(COURSE_LANGUAGE_DIALOG_HANDLES.DELETE_CONFIRM_BUTTON));

    await waitFor(() => {
      expect(mocks.deleteLanguage).toHaveBeenCalledWith({
        courseId: "course-1",
        language: "pl",
      });
      expect(onChange).toHaveBeenCalledWith("en");
    });
  });
});
