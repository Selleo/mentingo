import type { SettingsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type SettingsUpdateData = {
  settingsId: UUIDType;
  actor: CurrentUser;
  previousSettingsData: SettingsActivityLogSnapshot | null;
  updatedSettingsData: SettingsActivityLogSnapshot | null;
  context?: Record<string, string>;
};

export class UpdateSettingsEvent {
  constructor(public readonly settingsUpdateData: SettingsUpdateData) {}
}
