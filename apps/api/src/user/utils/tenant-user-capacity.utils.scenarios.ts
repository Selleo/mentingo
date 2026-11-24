import { TENANT_USER_CAPACITY_ALERT_LEVELS } from "@repo/shared";

/** 200 users in the plan with a 10% overflow: 220 users fit, the first alert comes at 160. */
export const ALERT_LEVEL_SCENARIOS = [
  {
    behaviour: "stays within the limit just below 80% of the plan",
    maxUsers: 200,
    allowedUsersCount: 220,
    activeUsersCount: 159,
    expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT,
  },
  {
    behaviour: "approaches the limit at 80% of the plan",
    maxUsers: 200,
    allowedUsersCount: 220,
    activeUsersCount: 160,
    expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.APPROACHING_LIMIT,
  },
  {
    behaviour: "still approaches the limit one user below the plan's maximum",
    maxUsers: 200,
    allowedUsersCount: 220,
    activeUsersCount: 199,
    expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.APPROACHING_LIMIT,
  },
  {
    behaviour: "reaches the limit at the plan's maximum",
    maxUsers: 200,
    allowedUsersCount: 220,
    activeUsersCount: 200,
    expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.LIMIT_REACHED,
  },
  {
    behaviour: "stays at the reached limit while overflow slots remain",
    maxUsers: 200,
    allowedUsersCount: 220,
    activeUsersCount: 219,
    expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.LIMIT_REACHED,
  },
  {
    behaviour: "is full when every slot including the overflow is taken",
    maxUsers: 200,
    allowedUsersCount: 220,
    activeUsersCount: 220,
    expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.CAPACITY_FULL,
  },
  {
    behaviour: "is over capacity with more users than slots",
    maxUsers: 200,
    allowedUsersCount: 220,
    activeUsersCount: 221,
    expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.OVER_CAPACITY,
  },
];

export const LIMIT_WITHOUT_OVERFLOW_SCENARIO = {
  activeUsersCount: 200,
  maxUsers: 200,
  allowedUsersCount: 200,
  expectedLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.CAPACITY_FULL,
};

export const LIMIT_CHANGE_SCENARIOS = [
  {
    behaviour: "treats a smaller maximum as lowered",
    previousUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
    currentUserLimit: { maxUsers: 150, maxUsersOverflowPercentage: 10 },
    isLowered: true,
  },
  {
    behaviour: "treats a smaller overflow as lowered",
    previousUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
    currentUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 0 },
    isLowered: true,
  },
  {
    behaviour: "compares the allowed users including the overflow",
    previousUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
    currentUserLimit: { maxUsers: 210, maxUsersOverflowPercentage: 0 },
    isLowered: true,
  },
  {
    behaviour: "treats setting a first limit as lowered",
    previousUserLimit: { maxUsers: null, maxUsersOverflowPercentage: 0 },
    currentUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 0 },
    isLowered: true,
  },
  {
    behaviour: "does not treat a larger limit as lowered",
    previousUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
    currentUserLimit: { maxUsers: 300, maxUsersOverflowPercentage: 10 },
    isLowered: false,
  },
  {
    behaviour: "does not treat removing the limit as lowered",
    previousUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
    currentUserLimit: { maxUsers: null, maxUsersOverflowPercentage: 10 },
    isLowered: false,
  },
  {
    behaviour: "does not treat an unchanged limit as lowered",
    previousUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
    currentUserLimit: { maxUsers: 200, maxUsersOverflowPercentage: 10 },
    isLowered: false,
  },
];
