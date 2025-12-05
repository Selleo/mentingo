import type { SettingsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type SettingsUpdateData = {
  settingsId: UUIDType;
  actorId: UUIDType;
  previousSettingsData: SettingsActivityLogSnapshot | null;
  updatedSettingsData: SettingsActivityLogSnapshot | null;
  context?: Record<string, string>;
};

export class UpdateSettingsEvent {
  constructor(public readonly settingsUpdateData: SettingsUpdateData) {}
}
