import { COURSE_STATUSES, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { PHISHING_OPTION_KINDS } from "src/phishing/constants/phishing.constants";

export const PASSWORD = "Password123@@";

export const HTTP_METHODS = { GET: "get", POST: "post" } as const;

export const ROLE_ACCESS_CASES = [
  {
    role: SYSTEM_ROLE_SLUGS.STUDENT,
    method: HTTP_METHODS.GET,
    path: "/api/phishing/campaigns",
    expectedStatus: 403,
  },
  {
    role: SYSTEM_ROLE_SLUGS.STUDENT,
    method: HTTP_METHODS.GET,
    path: "/api/phishing/configuration",
    expectedStatus: 403,
  },
  {
    role: SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
    method: HTTP_METHODS.GET,
    path: "/api/phishing/scenarios",
    expectedStatus: 403,
  },
  {
    role: SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
    method: HTTP_METHODS.POST,
    path: "/api/phishing/campaigns",
    expectedStatus: 403,
  },
  {
    role: SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
    method: HTTP_METHODS.GET,
    path: "/api/phishing/campaigns",
    expectedStatus: 200,
  },
  {
    role: SYSTEM_ROLE_SLUGS.ADMIN,
    method: HTTP_METHODS.GET,
    path: "/api/phishing/scenarios",
    expectedStatus: 200,
  },
] as const;

export const PLUGIN_FAILURES = {
  MISSING_SETTINGS: "missingSettings",
  SIMULATIONS_DISABLED: "simulationsDisabled",
  PLUGIN_ERROR: "pluginError",
} as const;

export type PluginFailure = (typeof PLUGIN_FAILURES)[keyof typeof PLUGIN_FAILURES];

export const PLUGIN_FAILURE_CASES = [
  {
    title: "the tenant has no plugin settings",
    failure: PLUGIN_FAILURES.MISSING_SETTINGS,
    pluginStatus: null,
    expectedStatus: 403,
    expectedMessage: "phishing.unavailable",
  },
  {
    title: "the plugin has simulations disabled",
    failure: PLUGIN_FAILURES.SIMULATIONS_DISABLED,
    pluginStatus: null,
    expectedStatus: 403,
    expectedMessage: "phishing.unavailable",
  },
  {
    title: "the plugin answers 403",
    failure: PLUGIN_FAILURES.PLUGIN_ERROR,
    pluginStatus: 403,
    expectedStatus: 403,
    expectedMessage: "phishing.unavailable",
  },
  {
    title: "the plugin answers 404",
    failure: PLUGIN_FAILURES.PLUGIN_ERROR,
    pluginStatus: 404,
    expectedStatus: 404,
    expectedMessage: "phishing.notFound",
  },
  {
    title: "the plugin answers 409",
    failure: PLUGIN_FAILURES.PLUGIN_ERROR,
    pluginStatus: 409,
    expectedStatus: 409,
    expectedMessage: "phishing.conflict",
  },
  {
    title: "the plugin answers 500",
    failure: PLUGIN_FAILURES.PLUGIN_ERROR,
    pluginStatus: 500,
    expectedStatus: 502,
    expectedMessage: "phishing.serviceError",
  },
] as const;

/** Names are distinctive so randomly generated users, groups and courses never match a search. */
export const OPTION_FIXTURE = {
  people: [
    { firstName: "Active", lastName: "Phishtarget", archived: false, deleted: false },
    { firstName: "Archived", lastName: "Phishtarget", archived: true, deleted: false },
    { firstName: "Deleted", lastName: "Phishtarget", archived: false, deleted: true },
  ],
  groups: ["Phishgroup Alpha", "Unrelated Team"],
  courses: [
    { title: "Phishcourse Free", status: COURSE_STATUSES.PUBLISHED, priceInCents: 0 },
    { title: "Phishcourse Draft", status: COURSE_STATUSES.DRAFT, priceInCents: 0 },
    { title: "Phishcourse Paid", status: COURSE_STATUSES.PUBLISHED, priceInCents: 1000 },
  ],
} as const;

export const OPTION_SEARCH_CASES = [
  {
    kind: PHISHING_OPTION_KINDS.USERS,
    search: "phishtarget",
    expectedLabelPrefixes: ["Active Phishtarget ("],
  },
  {
    kind: PHISHING_OPTION_KINDS.GROUPS,
    search: "phishgroup",
    expectedLabelPrefixes: ["Phishgroup Alpha"],
  },
  {
    kind: PHISHING_OPTION_KINDS.COURSES,
    search: "phishcourse",
    expectedLabelPrefixes: ["Phishcourse Free"],
  },
] as const;

export const CAMPAIGN_COURSES = { FREE: "free", DRAFT: "draft", PAID: "paid" } as const;

export const CAMPAIGN_AUDIENCES = {
  ACTIVE_LEARNER: "activeLearner",
  ARCHIVED_LEARNER: "archivedLearner",
  GROUP_WITHOUT_ACTIVE_MEMBERS: "groupWithoutActiveMembers",
} as const;

export type CampaignCourse = (typeof CAMPAIGN_COURSES)[keyof typeof CAMPAIGN_COURSES];
export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[keyof typeof CAMPAIGN_AUDIENCES];

const VALID_SEND_WINDOW_HOURS = { start: 1, end: 24 };

export const REJECTED_CAMPAIGN_CASES = [
  {
    title: "a blank name",
    name: "   ",
    sendWindowHours: VALID_SEND_WINDOW_HOURS,
    course: CAMPAIGN_COURSES.FREE,
    audience: CAMPAIGN_AUDIENCES.ACTIVE_LEARNER,
    expectedMessage: "phishing.invalidCampaign",
  },
  {
    title: "a send window that ends before it starts",
    name: "Quarterly drill",
    sendWindowHours: { start: 24, end: 1 },
    course: CAMPAIGN_COURSES.FREE,
    audience: CAMPAIGN_AUDIENCES.ACTIVE_LEARNER,
    expectedMessage: "phishing.invalidCampaign",
  },
  {
    title: "a send window longer than 30 days",
    name: "Quarterly drill",
    sendWindowHours: { start: 1, end: 31 * 24 },
    course: CAMPAIGN_COURSES.FREE,
    audience: CAMPAIGN_AUDIENCES.ACTIVE_LEARNER,
    expectedMessage: "phishing.invalidCampaign",
  },
  {
    title: "a send window that already ended",
    name: "Quarterly drill",
    sendWindowHours: { start: -48, end: -24 },
    course: CAMPAIGN_COURSES.FREE,
    audience: CAMPAIGN_AUDIENCES.ACTIVE_LEARNER,
    expectedMessage: "phishing.invalidCampaign",
  },
  {
    title: "a draft course",
    name: "Quarterly drill",
    sendWindowHours: VALID_SEND_WINDOW_HOURS,
    course: CAMPAIGN_COURSES.DRAFT,
    audience: CAMPAIGN_AUDIENCES.ACTIVE_LEARNER,
    expectedMessage: "phishing.invalidCourse",
  },
  {
    title: "a paid course",
    name: "Quarterly drill",
    sendWindowHours: VALID_SEND_WINDOW_HOURS,
    course: CAMPAIGN_COURSES.PAID,
    audience: CAMPAIGN_AUDIENCES.ACTIVE_LEARNER,
    expectedMessage: "phishing.invalidCourse",
  },
  {
    title: "an archived person",
    name: "Quarterly drill",
    sendWindowHours: VALID_SEND_WINDOW_HOURS,
    course: CAMPAIGN_COURSES.FREE,
    audience: CAMPAIGN_AUDIENCES.ARCHIVED_LEARNER,
    expectedMessage: "phishing.invalidRecipients",
  },
  {
    title: "a group without active members",
    name: "Quarterly drill",
    sendWindowHours: VALID_SEND_WINDOW_HOURS,
    course: CAMPAIGN_COURSES.FREE,
    audience: CAMPAIGN_AUDIENCES.GROUP_WITHOUT_ACTIVE_MEMBERS,
    expectedMessage: "phishing.invalidRecipients",
  },
] as const;

export const HIDDEN_REPORT_CASES = [
  {
    title: "the manager has no managed groups",
    managerHasGroup: false,
    expectedReportRequests: 0,
  },
  {
    title: "the campaign never reached the manager's groups",
    managerHasGroup: true,
    expectedReportRequests: 3,
  },
] as const;

export const CONFIGURATION_CASES = [
  { simulationsEnabled: true },
  { simulationsEnabled: false },
] as const;
