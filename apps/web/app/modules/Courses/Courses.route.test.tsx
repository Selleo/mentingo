import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import CoursesPage from "./Courses.page";

import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  user: null as { permissions: string[] } | null,
  settings: { modernCourseListEnabled: true },
  userSettings: vi.fn(),
  renderedLanguages: [] as string[],
}));
vi.mock("~/api/queries/useCurrentUserSessionSuspense", () => ({
  useCurrentUserSessionSuspense: () => ({ data: mocks.user }),
}));
vi.mock("~/api/queries/usePublicGlobalSettingsSuspense", () => ({
  usePublicGlobalSettingsSuspense: () => ({ data: mocks.settings }),
}));
vi.mock("~/api/queries/useUserSettings", () => ({ useUserSettingsSuspense: mocks.userSettings }));
vi.mock("~/Guards/AccessGuard", () => ({
  ContentAccessGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("~/modules/Courses/components/modern/ModernCoursesView", () => ({
  default: function MockModernCoursesView() {
    const language = useLanguageStore((state) => state.language);
    mocks.renderedLanguages.push(language);
    return <div>Courses {language}</div>;
  },
}));
vi.mock("~/modules/Courses/components/modern/GroupManagerModernCoursesView", () => ({
  default: () => <div>Managed courses</div>,
}));
vi.mock("~/modules/Courses/LegacyCoursesView", () => ({
  default: () => <div>Legacy courses</div>,
}));

function mount() {
  return render(
    <MemoryRouter initialEntries={["/courses"]}>
      <Routes>
        <Route path="courses" element={<CoursesPage />} />
        <Route path="dashboard" element={<div>Dashboard fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("courses route without loaders", () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.userSettings.mockReset().mockReturnValue({ data: { language: SUPPORTED_LANGUAGES.PL } });
    mocks.renderedLanguages = [];
    useLanguageStore.getState().setLanguage(SUPPORTED_LANGUAGES.EN);
  });

  it("renders public courses without requesting user settings", () => {
    mount();
    expect(screen.getByText("Courses en")).toBeInTheDocument();
    expect(mocks.userSettings).not.toHaveBeenCalled();
  });

  it("initializes the authenticated language before course queries mount", async () => {
    mocks.user = { permissions: [PERMISSIONS.COURSE_READ] };
    mount();
    await screen.findByText("Courses pl");
    expect(mocks.renderedLanguages).toEqual([SUPPORTED_LANGUAGES.PL]);
  });

  it("redirects users without course permission before course queries mount", async () => {
    mocks.user = { permissions: [PERMISSIONS.DASHBOARD_READ] };
    mount();
    await waitFor(() => expect(screen.getByText("Dashboard fallback")).toBeInTheDocument());
    expect(mocks.renderedLanguages).toEqual([]);
    expect(mocks.userSettings).not.toHaveBeenCalled();
  });

  it("retains the group-manager course view", () => {
    mocks.user = { permissions: [PERMISSIONS.MANAGED_GROUP_RESULTS_READ] };
    mount();
    expect(screen.getByText("Managed courses")).toBeInTheDocument();
  });
});
