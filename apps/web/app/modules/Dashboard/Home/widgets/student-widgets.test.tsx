import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { WidgetStudentAiMentorPractice } from "./student-ai-mentor-practice";
import { WidgetStudentCertificates } from "./student-certificates";
import { WidgetStudentContinueLearning } from "./student-continue-learning";
import { WidgetStudentCourseCompletion } from "./student-course-completion";
import { WidgetStudentRequiredCourse } from "./student-required-course";

import type { ComponentType } from "react";

const { states } = vi.hoisted(() => ({
  states: {
    course: {},
    certificate: {},
    dashboardCertificates: {},
    practice: {},
  } as Record<string, Record<string, unknown>>,
}));

vi.mock("~/api/queries/useStudentDashboardSummary", () => ({
  useStudentDashboardSummary: () => states.course,
}));
vi.mock("~/api/queries/useCertificateDashboardSummary", () => ({
  useCertificateDashboardSummary: () => states.certificate,
}));
vi.mock("~/api/queries/useDashboardCertificates", () => ({
  useDashboardCertificates: () => states.dashboardCertificates,
}));
vi.mock("~/api/queries/useAiMentorPracticeToday", () => ({
  useAiMentorPracticeToday: () => states.practice,
}));

const refetch = vi.fn();
const renderWidget = (Component: ComponentType) =>
  renderWith().render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
const populatedCourseSummary = {
  continueLearningCourses: [
    {
      courseId: "course-id",
      slug: "course-slug",
      title: "Communication essentials",
      thumbnailUrl: null,
      completedChapterCount: 1,
      courseChapterCount: 3,
      lesson: { id: "lesson-id", title: "Give useful feedback" },
    },
    {
      courseId: "second-course-id",
      slug: "second-course",
      title: "Leadership foundations",
      thumbnailUrl: null,
      completedChapterCount: 2,
      courseChapterCount: 4,
      lesson: null,
    },
  ],
  requiredCourses: [
    {
      courseId: "required-id",
      slug: "required-course",
      title: "Security training",
      dueDate: "2026-08-01T00:00:00.000Z",
      urgency: "dueSoon",
    },
    {
      courseId: "required-without-deadline-id",
      slug: "required-without-deadline",
      title: "Code of conduct",
      dueDate: null,
      urgency: "noDeadline",
    },
  ],
  completion: {
    total: 4,
    completed: 1,
    inProgress: 2,
    notStarted: 1,
    percentage: 25,
  },
} as const;

const widgets = [
  {
    name: "Continue learning",
    Component: WidgetStudentContinueLearning,
    query: "course",
    populatedText: "Communication essentials",
    emptyText: "You have no courses in progress.",
  },
  {
    name: "Required course",
    Component: WidgetStudentRequiredCourse,
    query: "course",
    populatedText: "Security training",
    emptyText: "You have no required courses to complete.",
  },
  {
    name: "Course completion",
    Component: WidgetStudentCourseCompletion,
    query: "course",
    populatedText: "25%",
    emptyText: "You have no assigned courses yet.",
  },
  {
    name: "Certificates",
    Component: WidgetStudentCertificates,
    query: "certificate",
    populatedText: "Active certificates",
    emptyText: "You do not have any active certificates.",
  },
  {
    name: "AI Mentor practice",
    Component: WidgetStudentAiMentorPractice,
    query: "practice",
    populatedText: "Today's practice is ready.",
    emptyText: "Describe a situation and practice it with AI Mentor.",
  },
] as const;

describe.each(widgets)("$name widget", ({ Component, query, populatedText, emptyText }) => {
  beforeEach(() => {
    states.course = {
      data: populatedCourseSummary,
      isLoading: false,
      isError: false,
      refetch,
    };
    states.certificate = {
      data: {
        activeCount: 2,
        expiringSoon: null,
      },
      isLoading: false,
      isError: false,
      refetch,
    };
    states.dashboardCertificates = {
      data: {
        data: [
          {
            id: "certificate-1",
            courseId: "course-id",
            courseTitle: "Communication essentials",
            issuedAt: "2026-07-01T00:00:00.000Z",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: null,
          },
          {
            id: "certificate-2",
            courseId: "second-course-id",
            courseTitle: "Leadership foundations",
            issuedAt: "2026-07-02T00:00:00.000Z",
            createdAt: "2026-07-02T00:00:00.000Z",
            expiresAt: "2027-07-02T00:00:00.000Z",
          },
        ],
        pagination: { totalItems: 2, page: 1, perPage: 10 },
      },
      isLoading: false,
      isError: false,
      refetch,
    };
    states.practice = {
      data: {
        id: "practice-id",
        title: "Difficult feedback",
        status: "ready",
      },
      isLoading: false,
      isError: false,
      refetch,
    };
  });

  it("renders populated data", () => {
    renderWidget(Component);

    expect(screen.getByText(populatedText)).toBeInTheDocument();
  });

  it("renders its exact empty state", () => {
    states.course = {
      data: {
        continueLearningCourses: [],
        requiredCourses: [],
        completion: { total: 0, completed: 0, inProgress: 0, notStarted: 0, percentage: 0 },
      },
      isLoading: false,
      isError: false,
      refetch,
    };
    states.certificate = {
      data: { activeCount: 0, expiringSoon: null },
      isLoading: false,
      isError: false,
      refetch,
    };
    states.practice = { data: null, isLoading: false, isError: false, refetch };

    renderWidget(Component);

    expect(screen.getByText(emptyText)).toBeInTheDocument();
  });

  it("renders a loading state", () => {
    states[query] = { isLoading: true, isError: false, refetch };

    const { container } = renderWidget(Component);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders an error with retry", () => {
    states[query] = { isLoading: false, isError: true, refetch };

    renderWidget(Component);

    expect(screen.getByText("We could not load this widget.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

it("shows every started and required course returned by the dashboard API", () => {
  states.course = {
    data: populatedCourseSummary,
    isLoading: false,
    isError: false,
    refetch,
  };

  renderWidget(WidgetStudentContinueLearning);
  expect(screen.getByText("Communication essentials")).toBeInTheDocument();
  expect(screen.getByText("Leadership foundations")).toBeInTheDocument();

  renderWidget(WidgetStudentRequiredCourse);
  expect(screen.getByText("Security training")).toBeInTheDocument();
  expect(screen.getByText("Code of conduct")).toBeInTheDocument();
  expect(screen.getByText("No deadline")).toBeInTheDocument();
});

it("opens a dialog with all loaded certificates", () => {
  states.certificate = {
    data: { activeCount: 2, expiringSoon: null },
    isLoading: false,
    isError: false,
    refetch,
  };
  states.dashboardCertificates = {
    data: {
      data: [
        {
          id: "certificate-1",
          courseId: "course-id",
          courseTitle: "Communication essentials",
          issuedAt: "2026-07-01T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
          expiresAt: null,
        },
        {
          id: "certificate-2",
          courseId: "second-course-id",
          courseTitle: "Leadership foundations",
          issuedAt: "2026-07-02T00:00:00.000Z",
          createdAt: "2026-07-02T00:00:00.000Z",
          expiresAt: "2027-07-02T00:00:00.000Z",
        },
      ],
      pagination: { totalItems: 2, page: 1, perPage: 10 },
    },
    isLoading: false,
    isError: false,
    refetch,
  };

  renderWidget(WidgetStudentCertificates);
  fireEvent.click(screen.getByRole("button", { name: /active certificates/i }));

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Communication essentials")).toBeInTheDocument();
  expect(screen.getByText("Leadership foundations")).toBeInTheDocument();
});
