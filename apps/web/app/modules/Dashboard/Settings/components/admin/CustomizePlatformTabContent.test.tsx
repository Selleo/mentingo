import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CustomizePlatformTabContent from "./CustomizePlatformTabContent";

import type { GlobalSettings } from "../../types";

const toggleGamification = vi.fn();

vi.mock("~/api/mutations/admin/useToggleGamificationEnabled", () => ({
  useToggleGamificationEnabled: () => ({ mutate: toggleGamification, isPending: false }),
}));
vi.mock("./Preferences", () => ({ default: () => null }));
vi.mock("./RegistrationFormBuilder", () => ({ RegistrationFormBuilder: () => null }));
vi.mock("./QAPreferences", () => ({ default: () => null }));
vi.mock("./NewsPreferences", () => ({ default: () => null }));
vi.mock("./ArticlesPreferences", () => ({ default: () => null }));
vi.mock("./LearningPathsPreferences", () => ({ default: () => null }));
vi.mock("./LeaderboardSettingsCard", () => ({ LeaderboardSettingsCard: () => null }));
vi.mock("./BrandingImagesCard", () => ({ BrandingImagesCard: () => null }));
vi.mock("./CertificateBackgroundUpload", () => ({ CertificateBackgroundUpload: () => null }));
vi.mock("./OrganizationLoginBackgroundUpload", () => ({
  OrganizationLoginBackgroundUpload: () => null,
}));
vi.mock("./OrganizationTheme", () => ({ OrganizationTheme: () => null }));
vi.mock("../../forms/PlatformLogoForm", () => ({ PlatformLogoForm: () => null }));
vi.mock("../../forms/PlatformSimpleLogoForm", () => ({ PlatformSimpleLogoForm: () => null }));

it("exposes the gamification preference in customization even when gamification is off", async () => {
  renderWith().render(
    <CustomizePlatformTabContent
      canManageUsers={false}
      globalSettings={{ gamificationEnabled: false } as GlobalSettings}
    />,
  );

  const toggle = screen.getByRole("switch");
  expect(toggle).toBeEnabled();
  expect(toggle).not.toBeChecked();
  await userEvent.click(toggle);

  expect(toggleGamification).toHaveBeenCalledTimes(1);
});
