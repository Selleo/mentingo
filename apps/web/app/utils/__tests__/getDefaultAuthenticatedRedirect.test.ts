import { PERMISSIONS } from "@repo/shared";

import { getDefaultAuthenticatedRedirect } from "../getDefaultAuthenticatedRedirect";

import type { CurrentUserResponse, GetPublicGlobalSettingsResponse } from "~/api/generated-api";

const currentUserWithPermissions = (
  permissions: CurrentUserResponse["data"]["permissions"],
): CurrentUserResponse["data"] =>
  ({
    id: "user-id",
    permissions,
  }) as CurrentUserResponse["data"];

const globalSettings = (
  overrides: Partial<GetPublicGlobalSettingsResponse["data"]> = {},
): GetPublicGlobalSettingsResponse["data"] =>
  ({
    learningPathsEnabled: true,
    ...overrides,
  }) as GetPublicGlobalSettingsResponse["data"];

describe("getDefaultAuthenticatedRedirect", () => {
  it("skips learning paths when the feature is disabled", () => {
    const user = currentUserWithPermissions([PERMISSIONS.LEARNING_PATH_READ]);

    expect(
      getDefaultAuthenticatedRedirect(user, globalSettings({ learningPathsEnabled: false }), {
        exclude: ["/courses"],
      }),
    ).toBe("/settings");
  });

  it("uses learning paths when the feature is enabled and no earlier route is available", () => {
    const user = currentUserWithPermissions([PERMISSIONS.LEARNING_PATH_READ]);

    expect(
      getDefaultAuthenticatedRedirect(user, globalSettings({ learningPathsEnabled: true }), {
        exclude: ["/courses"],
      }),
    ).toBe("/development-paths");
  });
});
