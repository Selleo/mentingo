export const USER_ADDITION_OUTCOMES = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;

export const USER_ADDITION_METHODS = {
  ADMIN_CREATE: "adminCreate",
  REGISTRATION: "registration",
  IMPORT: "import",
  UNARCHIVE: "unarchive",
} as const;

export const USER_LIMIT_ERROR_MESSAGE = "user.error.userLimitReached";

export const USER_LIMIT_SCENARIOS = [
  {
    behaviour: "accepts a user while the tenant is below its maximum",
    maxUsers: 5,
    maxUsersOverflowPercentage: 0,
    activeUsersCount: 3,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
  {
    behaviour: "accepts the user that fills the maximum",
    maxUsers: 5,
    maxUsersOverflowPercentage: 0,
    activeUsersCount: 4,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
  {
    behaviour: "rejects a user beyond the maximum when no overflow is allowed",
    maxUsers: 5,
    maxUsersOverflowPercentage: 0,
    activeUsersCount: 5,
    outcome: USER_ADDITION_OUTCOMES.REJECTED,
  },
  {
    behaviour: "accepts a user within the overflow",
    maxUsers: 10,
    maxUsersOverflowPercentage: 20,
    activeUsersCount: 11,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
  {
    behaviour: "rejects a user beyond the overflow",
    maxUsers: 10,
    maxUsersOverflowPercentage: 20,
    activeUsersCount: 12,
    outcome: USER_ADDITION_OUTCOMES.REJECTED,
  },
  {
    behaviour: "rounds the overflow down to whole users",
    maxUsers: 10,
    maxUsersOverflowPercentage: 15,
    activeUsersCount: 11,
    outcome: USER_ADDITION_OUTCOMES.REJECTED,
  },
  {
    behaviour: "accepts users when the tenant has no limit",
    maxUsers: null,
    maxUsersOverflowPercentage: 0,
    activeUsersCount: 6,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
];

export const USER_ADDITION_METHOD_SCENARIOS = [
  {
    method: USER_ADDITION_METHODS.ADMIN_CREATE,
    maxUsers: 3,
    activeUsersCount: 2,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
  {
    method: USER_ADDITION_METHODS.ADMIN_CREATE,
    maxUsers: 3,
    activeUsersCount: 3,
    outcome: USER_ADDITION_OUTCOMES.REJECTED,
  },
  {
    method: USER_ADDITION_METHODS.REGISTRATION,
    maxUsers: 3,
    activeUsersCount: 2,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
  {
    method: USER_ADDITION_METHODS.REGISTRATION,
    maxUsers: 3,
    activeUsersCount: 3,
    outcome: USER_ADDITION_OUTCOMES.REJECTED,
  },
  {
    method: USER_ADDITION_METHODS.IMPORT,
    maxUsers: 3,
    activeUsersCount: 2,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
  {
    method: USER_ADDITION_METHODS.IMPORT,
    maxUsers: 3,
    activeUsersCount: 3,
    outcome: USER_ADDITION_OUTCOMES.REJECTED,
  },
  {
    method: USER_ADDITION_METHODS.UNARCHIVE,
    maxUsers: 3,
    activeUsersCount: 2,
    outcome: USER_ADDITION_OUTCOMES.ACCEPTED,
  },
  {
    method: USER_ADDITION_METHODS.UNARCHIVE,
    maxUsers: 3,
    activeUsersCount: 3,
    outcome: USER_ADDITION_OUTCOMES.REJECTED,
  },
];
