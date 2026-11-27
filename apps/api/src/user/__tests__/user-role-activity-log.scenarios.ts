export const ROLE_CHANGE_METHODS = {
  SINGLE: "single",
  BULK: "bulk",
} as const;

export type RoleChangeMethod = (typeof ROLE_CHANGE_METHODS)[keyof typeof ROLE_CHANGE_METHODS];

export const ROLE_CHANGE_CASES = [
  {
    title: "logs a role change made on one user",
    method: ROLE_CHANGE_METHODS.SINGLE,
    changedUserCount: 1,
  },
  {
    title: "logs a role change for every user of a bulk change",
    method: ROLE_CHANGE_METHODS.BULK,
    changedUserCount: 2,
  },
] as const;

export const EXPECTED_ROLE_CHANGE_METADATA = {
  changedFields: ["roleSlugs"],
  before: { roleSlugs: '["student"]' },
  after: { roleSlugs: '["content_creator"]' },
} as const;

export const USER_ROLE_ACTIVITY_LOG_TABLES = [
  "outbox_events",
  "activity_logs",
  "settings",
  "users",
] as const;
