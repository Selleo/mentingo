import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { GamificationFeatureGuard } from "./GamificationFeatureGuard";
import {
  GAMIFICATION_FEATURES,
  type GamificationFeature,
} from "./GamificationFeatureGuard.constants";

const settingsQuery = vi.hoisted(() => ({
  data: undefined as { gamificationEnabled: boolean; leaderboardsEnabled: boolean } | undefined,
  isPending: false,
  error: null as Error | null,
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => settingsQuery,
}));

const mounted = vi.fn();
const ProtectedPage = () => {
  mounted();
  return <div>Protected page</div>;
};

const renderGuardedPage = (feature: GamificationFeature) => {
  const Router = createRemixStub([
    {
      path: "/guarded",
      Component: () => (
        <GamificationFeatureGuard feature={feature}>
          <ProtectedPage />
        </GamificationFeatureGuard>
      ),
    },
    { path: "/", Component: () => <div>Safe destination</div> },
  ]);
  return renderWith().render(<Router initialEntries={["/guarded"]} />);
};

beforeEach(() => {
  settingsQuery.data = { gamificationEnabled: false, leaderboardsEnabled: true };
  settingsQuery.isPending = false;
  settingsQuery.error = null;
  mounted.mockClear();
});

describe("GamificationFeatureGuard", () => {
  it.each([
    {
      feature: GAMIFICATION_FEATURES.GAMIFICATION,
      settings: { gamificationEnabled: false, leaderboardsEnabled: true },
    },
    {
      feature: GAMIFICATION_FEATURES.LEADERBOARDS,
      settings: { gamificationEnabled: false, leaderboardsEnabled: true },
    },
    {
      feature: GAMIFICATION_FEATURES.LEADERBOARDS,
      settings: { gamificationEnabled: true, leaderboardsEnabled: false },
    },
  ])(
    "redirects $feature pages without mounting them when disabled",
    async ({ feature, settings }) => {
      settingsQuery.data = settings;
      renderGuardedPage(feature);

      expect(await screen.findByText("Safe destination")).toBeInTheDocument();
      expect(mounted).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      feature: GAMIFICATION_FEATURES.GAMIFICATION,
      settings: { gamificationEnabled: true, leaderboardsEnabled: false },
    },
    {
      feature: GAMIFICATION_FEATURES.LEADERBOARDS,
      settings: { gamificationEnabled: true, leaderboardsEnabled: true },
    },
  ])("renders $feature pages when enabled", async ({ feature, settings }) => {
    settingsQuery.data = settings;
    renderGuardedPage(feature);

    expect(await screen.findByText("Protected page")).toBeInTheDocument();
  });

  it("does not mount the page while settings are loading", () => {
    settingsQuery.data = undefined;
    settingsQuery.isPending = true;
    renderGuardedPage(GAMIFICATION_FEATURES.GAMIFICATION);

    expect(mounted).not.toHaveBeenCalled();
    expect(screen.queryByText("Safe destination")).not.toBeInTheDocument();
  });

  it("shows an error instead of redirecting when settings fail to load", async () => {
    settingsQuery.data = undefined;
    settingsQuery.error = new Error("Network Error");
    renderGuardedPage(GAMIFICATION_FEATURES.GAMIFICATION);

    expect(await screen.findByRole("button")).toBeInTheDocument();
    expect(screen.queryByText("Safe destination")).not.toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });
});
