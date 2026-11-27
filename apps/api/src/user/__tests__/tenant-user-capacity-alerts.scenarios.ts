/** 10 users in the plan with a 20% overflow: 12 users fit, the first alert comes at 8. */
export const ALERT_TEST_USER_LIMIT = { maxUsers: 10, maxUsersOverflowPercentage: 20 };

export const CAPACITY_ALERT_TITLES = {
  APPROACHING_LIMIT: "Your organization is approaching its user limit",
  LIMIT_REACHED: "Your organization has reached its user limit",
  CAPACITY_FULL: "Your organization can't add more users",
  OVER_CAPACITY: "Your organization has more users than its limit allows",
} as const;

export const USER_REMOVAL_METHODS = {
  ARCHIVE: "archive",
  DELETE: "delete",
} as const;

export const CAPACITY_THRESHOLD_SCENARIOS = [
  {
    behaviour: "stays silent while less than 80% of the plan is used",
    activeUsersCount: 6,
    expectedAlert: null,
  },
  {
    behaviour: "warns admins when 80% of the plan is used",
    activeUsersCount: 7,
    expectedAlert: {
      title: CAPACITY_ALERT_TITLES.APPROACHING_LIMIT,
      message: "8 of the 10 users in your plan are active.",
    },
  },
  {
    behaviour: "alerts admins when the plan's maximum is reached",
    activeUsersCount: 9,
    expectedAlert: {
      title: CAPACITY_ALERT_TITLES.LIMIT_REACHED,
      message: "10 users are active and your plan includes 10. You can have up to 12 users",
    },
  },
  {
    behaviour: "alerts admins when the last user slot is taken",
    activeUsersCount: 11,
    expectedAlert: {
      title: CAPACITY_ALERT_TITLES.CAPACITY_FULL,
      message: "All 12 user slots are in use",
    },
  },
];

/** Each scenario starts at 8 active users, after the "approaching" alert was sent. */
export const LIMIT_CHANGE_SCENARIOS = [
  {
    behaviour: "repeats the current alert with the new numbers when the limit is lowered",
    newUserLimit: { maxUsers: 9, maxUsersOverflowPercentage: 0 },
    expectedAlert: {
      title: CAPACITY_ALERT_TITLES.APPROACHING_LIMIT,
      message: "8 of the 9 users in your plan are active.",
    },
  },
  {
    behaviour: "tells admins how many users to archive when the limit drops below usage",
    newUserLimit: { maxUsers: 5, maxUsersOverflowPercentage: 0 },
    expectedAlert: {
      title: CAPACITY_ALERT_TITLES.OVER_CAPACITY,
      message: "8 users are active, but your limit is now 5.",
    },
  },
  {
    behaviour: "stays silent when the limit is raised",
    newUserLimit: { maxUsers: 100, maxUsersOverflowPercentage: 0 },
    expectedAlert: null,
  },
  {
    behaviour: "stays silent when the limit is removed",
    newUserLimit: { maxUsers: null, maxUsersOverflowPercentage: 0 },
    expectedAlert: null,
  },
];

export const USER_REMOVAL_SCENARIOS = [
  { removalMethod: USER_REMOVAL_METHODS.ARCHIVE },
  { removalMethod: USER_REMOVAL_METHODS.DELETE },
];
