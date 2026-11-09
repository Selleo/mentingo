import { LEADERBOARD_VISIBILITY } from "@repo/shared";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LEADERBOARD_HANDLES } from "../../../../../../e2e/data/gamification/handles";

import { LeaderboardSettingsCard } from "./LeaderboardSettingsCard";

import type { GlobalSettings } from "../../types";

const updateLeaderboardSettings = vi.fn();

vi.mock("~/api/mutations/admin/useUpdateLeaderboardSettings", () => ({
  useUpdateLeaderboardSettings: () => ({ mutate: updateLeaderboardSettings, isPending: false }),
}));

const renderCard = (settings: Partial<GlobalSettings>) =>
  renderWith().render(
    <LeaderboardSettingsCard
      globalSettings={
        {
          gamificationEnabled: true,
          leaderboardsEnabled: true,
          leaderboardVisibility: LEADERBOARD_VISIBILITY.CLOSED,
          ...settings,
        } as GlobalSettings
      }
    />,
  );

const visibilityRadios = () =>
  within(screen.getByTestId(LEADERBOARD_HANDLES.SETTINGS_VISIBILITY)).getAllByRole("radio");

describe("LeaderboardSettingsCard", () => {
  beforeEach(() => updateLeaderboardSettings.mockClear());

  it("is hidden while gamification is off", () => {
    renderCard({ gamificationEnabled: false });

    expect(screen.queryByTestId(LEADERBOARD_HANDLES.SETTINGS_CARD)).not.toBeInTheDocument();
  });

  it("toggles leaderboards", async () => {
    renderCard({ leaderboardsEnabled: false });

    await userEvent.click(screen.getByTestId(LEADERBOARD_HANDLES.SETTINGS_ENABLED_SWITCH));

    expect(updateLeaderboardSettings).toHaveBeenCalledWith({ leaderboardsEnabled: true });
  });

  it("locks the visibility while leaderboards are off", () => {
    renderCard({ leaderboardsEnabled: false });

    visibilityRadios().forEach((radio) => expect(radio).toBeDisabled());
  });

  it("changes the visibility while leaderboards are on", async () => {
    renderCard({});

    const [closed, publicOption] = visibilityRadios();

    expect(closed).toBeChecked();
    await userEvent.click(publicOption);

    expect(updateLeaderboardSettings).toHaveBeenCalledWith({
      leaderboardVisibility: LEADERBOARD_VISIBILITY.PUBLIC,
    });
  });
});
