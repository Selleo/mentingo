import { MAX_COURSE_LEARNING_OUTCOMES } from "@repo/shared";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseWhatYouWillLearn from "./CourseWhatYouWillLearn";

import type { GetCourseResponse } from "~/api/generated-api";

const updateCourse = vi.fn();
let mockedCourse: GetCourseResponse["data"];
let mockedIsAdminExperience = false;

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: mockedCourse,
    isAdminExperience: mockedIsAdminExperience,
  }),
}));

vi.mock("~/api/mutations/admin/useUpdateCourse", () => ({
  useUpdateCourse: () => ({
    mutateAsync: updateCourse,
    isPending: false,
  }),
}));

const createCourse = (
  overrides: Partial<GetCourseResponse["data"]> = {},
): GetCourseResponse["data"] =>
  ({
    id: "course-1",
    learningOutcomes: [],
    ...overrides,
  }) as GetCourseResponse["data"];

describe("CourseWhatYouWillLearn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCourse = createCourse();
    mockedIsAdminExperience = false;
  });

  it("does not render for students when the course has no learning outcomes", () => {
    const { container } = renderWith().render(
      <CourseWhatYouWillLearn courseOutcomes={[]} language="en" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders read-only learning outcomes for students", () => {
    renderWith().render(
      <CourseWhatYouWillLearn courseOutcomes={["Clean data", "Build dashboards"]} language="en" />,
    );

    expect(screen.getByText("What you'll master")).toBeInTheDocument();
    expect(screen.getByText("Clean data")).toBeInTheDocument();
    expect(screen.getByText("Build dashboards")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add learning outcome" })).not.toBeInTheDocument();
  });

  it("lets admins add a learning outcome and saves it for the current language", async () => {
    const user = userEvent.setup();
    mockedIsAdminExperience = true;
    mockedCourse = createCourse();

    renderWith().render(<CourseWhatYouWillLearn courseOutcomes={[]} language="pl" />);

    await user.click(screen.getByRole("button", { name: "Add learning outcome" }));

    const input = screen.getByPlaceholderText("Add a learning outcome...");
    expect(input.parentElement).toHaveClass("items-center");

    await user.type(input, "  Nowy efekt nauki  ");
    await user.tab();

    await waitFor(() => {
      expect(updateCourse).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          language: "pl",
          learningOutcomes: ["Nowy efekt nauki"],
        },
      });
    });
  });

  it("does not save when the normalized outcomes did not change", async () => {
    const user = userEvent.setup();
    mockedIsAdminExperience = true;
    mockedCourse = createCourse({ learningOutcomes: ["Existing outcome"] });

    renderWith().render(
      <CourseWhatYouWillLearn courseOutcomes={["Existing outcome"]} language="en" />,
    );

    await user.click(screen.getByRole("button", { name: "Existing outcome" }));
    await user.tab();

    expect(updateCourse).not.toHaveBeenCalled();
  });

  it("updates an existing learning outcome", async () => {
    const user = userEvent.setup();
    mockedIsAdminExperience = true;
    mockedCourse = createCourse({ learningOutcomes: ["Existing outcome"] });

    renderWith().render(
      <CourseWhatYouWillLearn courseOutcomes={["Existing outcome"]} language="en" />,
    );

    await user.click(screen.getByRole("button", { name: "Existing outcome" }));

    const input = screen.getByDisplayValue("Existing outcome");
    await user.clear(input);
    await user.type(input, "Updated outcome");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(updateCourse).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          language: "en",
          learningOutcomes: ["Updated outcome"],
        },
      });
    });
  });

  it("removes a learning outcome", async () => {
    const user = userEvent.setup();
    mockedIsAdminExperience = true;
    mockedCourse = createCourse({ learningOutcomes: ["Outcome to remove", "Outcome to keep"] });

    renderWith().render(
      <CourseWhatYouWillLearn
        courseOutcomes={["Outcome to remove", "Outcome to keep"]}
        language="en"
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Remove learning outcome" })[0]);

    await waitFor(() => {
      expect(updateCourse).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          language: "en",
          learningOutcomes: ["Outcome to keep"],
        },
      });
    });
  });

  it("removes an outcome saved with an empty value", async () => {
    const user = userEvent.setup();
    mockedIsAdminExperience = true;
    mockedCourse = createCourse({ learningOutcomes: ["Outcome to clear"] });

    renderWith().render(
      <CourseWhatYouWillLearn courseOutcomes={["Outcome to clear"]} language="en" />,
    );

    await user.click(screen.getByRole("button", { name: "Outcome to clear" }));
    await user.clear(screen.getByDisplayValue("Outcome to clear"));
    await user.tab();

    await waitFor(() => {
      expect(updateCourse).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          language: "en",
          learningOutcomes: [],
        },
      });
    });
  });

  it("limits a course to five learning outcomes", () => {
    mockedIsAdminExperience = true;
    const outcomes = Array.from(
      { length: MAX_COURSE_LEARNING_OUTCOMES + 1 },
      (_, index) => `Outcome ${index + 1}`,
    );
    mockedCourse = createCourse({ learningOutcomes: outcomes });

    renderWith().render(<CourseWhatYouWillLearn courseOutcomes={outcomes} language="en" />);

    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add learning outcome" })).toBeDisabled();
    expect(screen.queryByText("Outcome 6")).not.toBeInTheDocument();
  });
});
