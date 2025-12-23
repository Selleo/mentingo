import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { renderWith } from "~/utils/testUtils";
import { CourseSettingsSwitches } from "./CourseSettingsSwitches";

const mockMutate = vi.fn();
const mockUseUpdateCourseSettings = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
}));

const mockUseCourseSettings = vi.fn(() => ({
  data: {
    quizFeedbackEnabled: true,
    lessonSequenceEnabled: false,
  },
  isLoading: false,
}));

vi.mock("~/api/mutations/useUpdateCourseSettings", () => ({
  useUpdateCourseSettings: () => mockUseUpdateCourseSettings(),
}));

vi.mock("~/api/queries/useCourseSettings", () => ({
  useCourseSettings: () => mockUseCourseSettings(),
}));

vi.mock("~/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("CourseSettingsSwitches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateCourseSettings.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    mockUseCourseSettings.mockReturnValue({
      data: {
        quizFeedbackEnabled: true,
        lessonSequenceEnabled: false,
      },
      isLoading: false,
    });
  });

  it("renders both switches", () => {
    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="test-course-id" />);

    expect(screen.getByLabelText(/enforce lesson sequence/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quiz feedback/i)).toBeInTheDocument();
  });

  it("displays quiz feedback switch as checked when enabled", () => {
    mockUseCourseSettings.mockReturnValue({
      data: {
        quizFeedbackEnabled: true,
        lessonSequenceEnabled: false,
      },
      isLoading: false,
    });

    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="test-course-id" />);

    const quizFeedbackSwitch = screen.getByLabelText(/quiz feedback/i);
    expect(quizFeedbackSwitch).toBeChecked();
  });

  it("displays quiz feedback switch as unchecked when disabled", () => {
    mockUseCourseSettings.mockReturnValue({
      data: {
        quizFeedbackEnabled: false,
        lessonSequenceEnabled: false,
      },
      isLoading: false,
    });

    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="test-course-id" />);

    const quizFeedbackSwitch = screen.getByLabelText(/quiz feedback/i);
    expect(quizFeedbackSwitch).not.toBeChecked();
  });

  it("calls updateCourseSettings when quiz feedback switch is toggled", async () => {
    const user = userEvent.setup();

    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="test-course-id" />);

    const quizFeedbackSwitch = screen.getByLabelText(/quiz feedback/i);
    await user.click(quizFeedbackSwitch);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        courseId: "test-course-id",
        data: { quizFeedbackEnabled: false },
      });
    });
  });

  it("calls updateCourseSettings when quiz feedback switch is toggled from false to true", async () => {
    const user = userEvent.setup();

    mockUseCourseSettings.mockReturnValue({
      data: {
        quizFeedbackEnabled: false,
        lessonSequenceEnabled: false,
      },
      isLoading: false,
    });

    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="test-course-id" />);

    const quizFeedbackSwitch = screen.getByLabelText(/quiz feedback/i);
    await user.click(quizFeedbackSwitch);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        courseId: "test-course-id",
        data: { quizFeedbackEnabled: true },
      });
    });
  });

  it("disables switches when loading", () => {
    mockUseCourseSettings.mockReturnValue({
      data: undefined as any,
      isLoading: true,
    });

    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="test-course-id" />);

    const quizFeedbackSwitch = screen.getByLabelText(/quiz feedback/i);
    expect(quizFeedbackSwitch).toBeDisabled();
  });

  it("disables switches when updating", () => {
    mockUseUpdateCourseSettings.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="test-course-id" />);

    const quizFeedbackSwitch = screen.getByLabelText(/quiz feedback/i);
    expect(quizFeedbackSwitch).toBeDisabled();
  });

  it("does not call updateCourseSettings when courseId is empty", async () => {
    const user = userEvent.setup();

    renderWith({ withQuery: true }).render(<CourseSettingsSwitches courseId="" />);

    const quizFeedbackSwitch = screen.getByLabelText(/quiz feedback/i);
    await user.click(quizFeedbackSwitch);

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });
});
