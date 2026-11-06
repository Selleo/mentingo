import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GamificationRewardToasts } from "./GamificationRewardToasts";

import type { UserGamificationProfile } from "./gamification.types";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  profile: undefined as unknown,
  isSupportMode: false,
  gamificationEnabled: true,
  useProfile: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("~/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAccess: true }) }));
vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUserSuspense: () => ({ data: { id: "user-1", isSupportMode: mocks.isSupportMode } }),
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: { gamificationEnabled: mocks.gamificationEnabled } }),
}));
vi.mock("~/api/queries/useUserGamificationProfile", () => ({
  useUserGamificationProfile: mocks.useProfile,
}));

const profileWithRewards = (...rewardIds: string[]) =>
  ({
    recentRewards: rewardIds.map((id) => ({
      id,
      achievementId: "achievement-1",
      achievementTitle: "First steps",
      level: 1,
      xpReward: 20,
      earnedAt: "2026-11-04T10:00:00Z",
    })),
  }) as unknown as UserGamificationProfile;

describe("GamificationRewardToasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupportMode = false;
    mocks.gamificationEnabled = true;
    mocks.useProfile.mockImplementation(() => ({ data: mocks.profile }));
  });

  it("toasts only rewards that appear after the first load", () => {
    mocks.profile = profileWithRewards("reward-1");
    const { rerender } = render(<GamificationRewardToasts />);

    expect(mocks.toast).not.toHaveBeenCalled();

    mocks.profile = profileWithRewards("reward-2", "reward-1");
    rerender(<GamificationRewardToasts />);

    expect(mocks.toast).toHaveBeenCalledTimes(1);

    mocks.profile = profileWithRewards("reward-2", "reward-1");
    rerender(<GamificationRewardToasts />);

    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("does not poll while gamification is disabled for the tenant", () => {
    mocks.gamificationEnabled = false;
    render(<GamificationRewardToasts />);

    expect(mocks.useProfile).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ enabled: false }),
    );
  });

  it("does not poll in support mode", () => {
    mocks.isSupportMode = true;
    render(<GamificationRewardToasts />);

    expect(mocks.useProfile).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ enabled: false }),
    );
  });
});
