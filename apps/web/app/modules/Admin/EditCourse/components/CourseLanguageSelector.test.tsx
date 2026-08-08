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
  it("shows an accessible flag-only value on small screens", () => {
    renderWith().render(
      <CourseLanguageSelector
        courseLanguage="pl"
        course={{
          id: "course-1",
          baseLanguage: "en",
          availableLocales: ["en", "pl"],
        }}
        isAIConfigured={false}
        onChange={vi.fn()}
        setOpenGenerateTranslationModal={vi.fn()}
        className="shrink-0"
        compactOnMobile
        selectTriggerClassName="w-14 min-w-14 px-2 sm:w-auto sm:min-w-[200px] sm:px-3"
      />,
    );

    const languageSelect = screen.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT);

    expect(languageSelect.parentElement).toHaveClass("shrink-0");
    expect(languageSelect).toHaveClass("w-14", "min-w-14", "sm:w-auto", "sm:min-w-[200px]");
    expect(languageSelect).toHaveAccessibleName("Polish");
    expect(screen.getByText("Polish")).toHaveClass("hidden", "sm:inline");
    expect(screen.getByTestId(EDIT_COURSE_PAGE_HANDLES.DELETE_LANGUAGE_BUTTON)).toBeInTheDocument();
  });

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

  it("opens the missing translations modal from the AI action", async () => {
    const user = userEvent.setup();
    const setOpenGenerateTranslationModal = vi.fn();

    renderWith().render(
      <CourseLanguageSelector
        courseLanguage="pl"
        course={{
          id: "course-1",
          baseLanguage: "en",
          availableLocales: ["en", "pl"],
        }}
        hasMissingTranslations
        isAIConfigured
        onChange={vi.fn()}
        setOpenGenerateTranslationModal={setOpenGenerateTranslationModal}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Generate missing translations" }));

    expect(setOpenGenerateTranslationModal).toHaveBeenCalledWith(true);
  });
});
