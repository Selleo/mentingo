import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RouteGuard } from "~/Guards/RouteGuard";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import UserDashboardLayout from "~/modules/Dashboard/UserDashboard.layout";
import { currentUser as currentUserFixture } from "~/utils/mocks/data/currentUser";
import { renderWith } from "~/utils/testUtils";

import { helpdeskTutorialFixture } from "./__tests__/fixtures";
import HelpdeskTutorialPage from "./SelfOnboardingTutorial.page";

import type { CurrentUserResponse } from "~/api/generated-api";

const session = vi.hoisted(() => ({ user: null as CurrentUserResponse["data"] | null }));
const reads = vi.hoisted(() => ({ tutorial: vi.fn() }));
vi.mock("~/api/queries", () => ({ useCurrentUserSuspense: () => ({ data: session.user }) }));
vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: session.user, isLoading: false }),
  useCurrentUserSuspense: () => ({ data: session.user }),
}));
vi.mock("~/api/queries/useCurrentUserSessionSuspense", () => ({
  useCurrentUserSessionSuspense: () => ({ data: session.user }),
}));
vi.mock("~/api/queries/self-onboarding/useSelfOnboardingTutorial", () => ({
  useHelpdeskTutorial: reads.tutorial,
}));
vi.mock("~/api/queries/self-onboarding/useSelfOnboardingSearch", () => ({
  useHelpdeskSearch: () => ({ data: undefined }),
}));
vi.mock("~/components/VideoPlayer/VideoPlayer", () => ({
  VideoPlayer: () => <div>Published help video</div>,
}));
vi.mock("~/modules/Dashboard/Dashboard", () => ({
  Dashboard: () => (
    <RouteGuard>
      <Outlet />
    </RouteGuard>
  ),
}));

function setup() {
  const App = createRemixStub([
    {
      Component: UserDashboardLayout,
      children: [{ path: "/helpdesk/tutorials/:key", Component: HelpdeskTutorialPage }],
    },
    { path: "/auth/login", Component: () => <div>Sign in required</div> },
    { path: "/auth/mfa", Component: () => <div>MFA required</div> },
    { path: "/auth/change-password", Component: () => <div>Password update required</div> },
  ]);
  renderWith().render(
    <App
      initialEntries={["/helpdesk/tutorials/course-authoring.publish-a-course?chapter=review"]}
    />,
  );
}

function account(
  overrides: Partial<CurrentUserResponse["data"]> = {},
): CurrentUserResponse["data"] {
  return {
    ...currentUserFixture.data,
    deletedAt: null,
    profilePictureUrl: null,
    roleSlugs: ["custom"],
    permissions: [],
    shouldVerifyMFA: false,
    requiresPasswordChange: false,
    onboardingStatus: {
      id: "onboarding",
      createdAt: currentUserFixture.data.createdAt,
      updatedAt: currentUserFixture.data.updatedAt,
      userId: currentUserFixture.data.id,
      dashboard: true,
      courses: true,
      announcements: true,
      profile: true,
      settings: true,
      providerInformation: true,
    },
    isManagingTenantAdmin: false,
    isSupportMode: false,
    studentModeCourseIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  session.user = null;
  reads.tutorial.mockReset();
  reads.tutorial.mockReturnValue({
    data: helpdeskTutorialFixture,
    isPending: false,
    isError: false,
  });
  useNavigationHistoryStore.getState().clearHistory();
  useCurrentUserStore.setState({ currentUser: undefined, hasVerifiedMFA: false });
});

describe("Helpdesk authenticated tutorial access", () => {
  it("preserves the chapter destination and redirects anonymous visitors before reading help", async () => {
    setup();
    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    expect(reads.tutorial).not.toHaveBeenCalled();
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/helpdesk/tutorials/course-authoring.publish-a-course?chapter=review",
    );
  });
  it("allows authenticated custom roles without course-management permissions", async () => {
    session.user = account();
    setup();
    expect(await screen.findByText("Published help video")).toBeInTheDocument();
    expect(reads.tutorial).toHaveBeenCalled();
  });
  it.each([
    { shouldVerifyMFA: true, requiresPasswordChange: false, destination: "MFA required" },
    {
      shouldVerifyMFA: false,
      requiresPasswordChange: true,
      destination: "Password update required",
    },
  ])(
    "keeps help reads behind account setup: $destination",
    async ({ destination, ...requirements }) => {
      session.user = account(requirements);
      setup();
      expect(await screen.findByText(destination)).toBeInTheDocument();
      expect(reads.tutorial).not.toHaveBeenCalled();
    },
  );
});
