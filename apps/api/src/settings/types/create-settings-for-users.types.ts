import type { UUIDType } from "src/common";
import type { SettingsJSONContentSchema } from "src/settings/schemas/settings.schema";

export type CreateSettingsForUsersGroup = {
  roleSlugs: string[];
  customSettings?: Partial<SettingsJSONContentSchema>;
  userIds: UUIDType[];
};

export type CreateSettingsForUsersItem = {
  userId: UUIDType;
  roleSlugs: string[];
  customSettings?: Partial<SettingsJSONContentSchema>;
};
