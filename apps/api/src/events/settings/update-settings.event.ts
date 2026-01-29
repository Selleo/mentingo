import type { SettingsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type SettingsUpdateData = {
  settingsId: UUIDType;
  actor: ActorUserType;
  previousSettingsData: SettingsActivityLogSnapshot | null;
  updatedSettingsData: SettingsActivityLogSnapshot | null;
  context?: Record<string, string>;
};

export class UpdateSettingsEvent {
  constructor(public readonly settingsUpdateData: SettingsUpdateData) {}
}
