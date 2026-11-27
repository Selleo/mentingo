import { TENANT_STATUSES } from "@repo/shared";

export const STARTING_USER_LIMIT = { maxUsers: 200, maxUsersOverflowPercentage: 10 };

export const USER_LIMIT_UPDATE_SCENARIOS = [
  {
    behaviour: "changes the maximum and the overflow",
    payload: { maxUsers: 150, maxUsersOverflowPercentage: 25 },
    expectedUserLimit: { maxUsers: 150, maxUsersOverflowPercentage: 25 },
  },
  {
    behaviour: "removes the limit and keeps the overflow for later",
    payload: { maxUsers: null },
    expectedUserLimit: { maxUsers: null, maxUsersOverflowPercentage: 10 },
  },
  {
    behaviour: "keeps the limit when other details change",
    payload: { status: TENANT_STATUSES.ACTIVE },
    expectedUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
  },
];

export const INVALID_USER_LIMIT_SCENARIOS = [
  { invalidValue: "a maximum of 0 users", payload: { maxUsers: 0 } },
  { invalidValue: "a fractional maximum", payload: { maxUsers: 1.5 } },
  { invalidValue: "a negative overflow", payload: { maxUsersOverflowPercentage: -1 } },
  { invalidValue: "an overflow above 100%", payload: { maxUsersOverflowPercentage: 101 } },
];
