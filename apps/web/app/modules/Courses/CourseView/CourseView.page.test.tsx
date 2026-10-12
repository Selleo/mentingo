import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import CourseViewPage from "./CourseView.page";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  settings: vi.fn(),
  userSettings: vi.fn(),
  lookup: vi.fn(),
  course: vi.fn(),
}));
vi.mock("~/api/queries/useCurrentUserSessionSuspense", () => ({
  useCurrentUserSessionSuspense: mocks.session,
}));
vi.mock("~/api/queries/usePublicGlobalSettingsSuspense", () => ({
  usePublicGlobalSettingsSuspense: mocks.settings,
}));
vi.mock("~/api/queries/useUserSettings", () => ({ useUserSettingsSuspense: mocks.userSettings }));
vi.mock("~/api/queries/useCourseLookup", () => ({ useCourseLookupSuspense: mocks.lookup }));
vi.mock("~/api/queries/useCourseAvailabilitySuspense", () => ({
  useCourseAvailabilitySuspense: mocks.course,
}));
vi.mock("./CourseUnavailable", () => ({
  default: ({ reason, canAccessCourseList }: { reason: string; canAccessCourseList: boolean }) => (
    <div>
      {reason}:{String(canAccessCourseList)}
    </div>
  ),
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("~/Guards/AccessGuard", () => ({
  ContentAccessGuard: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  CourseAccessProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("~/modules/Courses/CourseView/CourseOverview/CourseOverview", () => ({
  default: () => <div>Course overview</div>,
}));
vi.mock("./CourseStatBar/CourseStatBar", () => ({ CourseStatBar: () => null }));
vi.mock("./LearningModeBanner", () => ({ LearningModeBanner: () => null }));
vi.mock("./TableOfContent/TableOfContent", () => ({ TableOfContent: () => null }));

const renderCourse = (path = "/course/example?language=pl&source=email") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/course/:id" element={<CourseViewPage />} />
        <Route path="/course/localized" element={<div>Localized course</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  useNavigationHistoryStore.getState().clearHistory();
  useLanguageStore.getState().setLanguage(SUPPORTED_LANGUAGES.EN);
  mocks.session.mockReturnValue({ data: null });
  mocks.settings.mockReturnValue({ data: { unregisteredUserCoursesAccessibility: true } });
  mocks.userSettings.mockReturnValue({ data: { language: SUPPORTED_LANGUAGES.DE } });
  mocks.lookup.mockReturnValue({ data: { status: "available", slug: "example" } });
  mocks.course.mockReturnValue({ data: null });
});

describe("course route access and suspense orchestration", () => {
  it("saves the full intended destination without fetching private course data", () => {
    mocks.settings.mockReturnValue({ data: { unregisteredUserCoursesAccessibility: false } });
    renderCourse();
    expect(screen.getByText("requiresAuthentication:false")).toBeInTheDocument();
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/course/example?language=pl&source=email",
    );
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.course).not.toHaveBeenCalled();
    expect(mocks.userSettings).not.toHaveBeenCalled();
  });

  it("allows anonymous public lookup in the requested language without fetching user settings", () => {
    renderCourse();
    expect(mocks.lookup).toHaveBeenCalledWith("example", SUPPORTED_LANGUAGES.PL);
    expect(mocks.course).toHaveBeenCalledWith("example", SUPPORTED_LANGUAGES.PL);
    expect(mocks.userSettings).not.toHaveBeenCalled();
    expect(screen.getByText("notFound:true")).toBeInTheDocument();
  });

  it("uses the authenticated application language when no content language is requested", () => {
    mocks.session.mockReturnValue({ data: { permissions: [PERMISSIONS.COURSE_READ] } });
    renderCourse("/course/example");
    expect(mocks.lookup).toHaveBeenCalledWith("example", SUPPORTED_LANGUAGES.DE);
  });

  it("renders unavailable lookup without requesting course detail and respects list permission", () => {
    mocks.session.mockReturnValue({ data: { permissions: [] } });
    mocks.lookup.mockReturnValue({ data: null });
    renderCourse();
    expect(screen.getByText("notFound:false")).toBeInTheDocument();
    expect(mocks.course).not.toHaveBeenCalled();
  });

  it("redirects localized slugs before requesting course detail", async () => {
    mocks.lookup.mockReturnValue({ data: { status: "redirect", slug: "localized" } });
    renderCourse();
    expect(await screen.findByText("Localized course")).toBeInTheDocument();
    expect(mocks.course).not.toHaveBeenCalled();
  });
});
