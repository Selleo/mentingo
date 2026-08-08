import { Reflector } from "@nestjs/core";
import { PERMISSIONS } from "@repo/shared";

import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { SettingsController } from "src/settings/settings.controller";
import { StatisticsController } from "src/statistics/statistics.controller";

import type { ExecutionContext } from "@nestjs/common";

const createContext = ({
  handler,
  controller,
  permissions,
}: {
  handler: (...args: never[]) => unknown;
  controller: object;
  permissions: string[];
}) =>
  ({
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  }) as unknown as ExecutionContext;

describe("PermissionsGuard self-permission endpoints", () => {
  const guard = new PermissionsGuard(new Reflector());

  it.each([
    [
      "GET /settings",
      SettingsController,
      SettingsController.prototype.getUserSettings,
      PERMISSIONS.SETTINGS_READ_SELF,
    ],
    [
      "PUT /settings",
      SettingsController,
      SettingsController.prototype.updateUserSettings,
      PERMISSIONS.SETTINGS_UPDATE_SELF,
    ],
    [
      "GET /statistics/user-stats",
      StatisticsController,
      StatisticsController.prototype.getUserStatistics,
      PERMISSIONS.STATISTICS_READ_SELF,
    ],
  ])("requires the declared permission for %s", (_name, controller, handler, permission) => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler)).toEqual([permission]);

    expect(
      guard.canActivate(
        createContext({
          controller,
          handler,
          permissions: [permission],
        }),
      ),
    ).toBe(true);

    expect(() =>
      guard.canActivate(
        createContext({
          controller,
          handler,
          permissions: [],
        }),
      ),
    ).toThrow("auth.error.missingPermission");
  });
});
