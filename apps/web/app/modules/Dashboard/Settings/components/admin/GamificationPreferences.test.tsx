import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import GamificationPreferences from "./GamificationPreferences";

import type { GlobalSettings } from "../../types";

const toggleGamification = vi.fn();
let isPending = false;

vi.mock("~/api/mutations/admin/useToggleGamificationEnabled", () => ({
  useToggleGamificationEnabled: () => ({ mutate: toggleGamification, isPending }),
}));

const renderCard = (gamificationEnabled: boolean) =>
  renderWith().render(
    <GamificationPreferences globalSettings={{ gamificationEnabled } as GlobalSettings} />,
  );

describe("GamificationPreferences", () => {
  beforeEach(() => {
    toggleGamification.mockClear();
    isPending = false;
  });

  it("locks the switch while the toggle mutation is pending", async () => {
    isPending = true;
    renderCard(true);

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    await userEvent.click(toggle);

    expect(toggleGamification).not.toHaveBeenCalled();
  });

  it("can enable gamification while the feature is off", async () => {
    renderCard(false);

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
    expect(toggle).toBeEnabled();
    await userEvent.click(toggle);

    expect(toggleGamification).toHaveBeenCalledTimes(1);
    expect(toggleGamification).toHaveBeenCalledWith();
  });
});
