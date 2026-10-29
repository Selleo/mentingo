import { COURSE_STATUSES } from "@repo/shared";

import { PHISHING_RISKY_ACTIONS } from "src/phishing/constants/phishing.constants";

export const SIGNED_REQUEST_KINDS = {
  VALID: "valid",
  WRONG_SECRET: "wrongSecret",
  STALE_TIMESTAMP: "staleTimestamp",
  BODY_CHANGED_AFTER_SIGNING: "bodyChangedAfterSigning",
  UNEXPECTED_FIELD: "unexpectedField",
} as const;

export type SignedRequestKind = (typeof SIGNED_REQUEST_KINDS)[keyof typeof SIGNED_REQUEST_KINDS];

export const STALE_SIGNATURE_AGE_SECONDS = 10 * 60;

export const CAMPAIGN_RECIPIENT_STATES = {
  CLICKED: "clicked",
  ABSENT: "absent",
} as const;

export type CampaignRecipientState =
  (typeof CAMPAIGN_RECIPIENT_STATES)[keyof typeof CAMPAIGN_RECIPIENT_STATES];

export const REJECTED_RISKY_ACTION_CASES = [
  {
    title: "a signature made with another secret",
    signedRequest: SIGNED_REQUEST_KINDS.WRONG_SECRET,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    action: PHISHING_RISKY_ACTIONS.CLICKED,
    pluginContacted: false,
  },
  {
    title: "a signature older than five minutes",
    signedRequest: SIGNED_REQUEST_KINDS.STALE_TIMESTAMP,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    action: PHISHING_RISKY_ACTIONS.CLICKED,
    pluginContacted: false,
  },
  {
    title: "a body changed after signing",
    signedRequest: SIGNED_REQUEST_KINDS.BODY_CHANGED_AFTER_SIGNING,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    action: PHISHING_RISKY_ACTIONS.CLICKED,
    pluginContacted: false,
  },
  {
    title: "an event with an unexpected field",
    signedRequest: SIGNED_REQUEST_KINDS.UNEXPECTED_FIELD,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    action: PHISHING_RISKY_ACTIONS.CLICKED,
    pluginContacted: false,
  },
  {
    title: "a learner who is not a campaign recipient",
    signedRequest: SIGNED_REQUEST_KINDS.VALID,
    recipient: CAMPAIGN_RECIPIENT_STATES.ABSENT,
    action: PHISHING_RISKY_ACTIONS.CLICKED,
    pluginContacted: true,
  },
  {
    title: "an action the plugin never recorded",
    signedRequest: SIGNED_REQUEST_KINDS.VALID,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    action: PHISHING_RISKY_ACTIONS.SUBMITTED,
    pluginContacted: true,
  },
] as const;

export const TRUSTED_TRACKING_URL = "https://tracker.example.com/t/abc123";

export const EMAIL_SCENARIO_ID = "course-reminder";

export const UNKNOWN_SCENARIO_ID = "scenario-without-email";

export const REJECTED_EMAIL_CASES = [
  {
    title: "a signature made with another secret",
    signedRequest: SIGNED_REQUEST_KINDS.WRONG_SECRET,
    trackingUrl: TRUSTED_TRACKING_URL,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    scenarioId: EMAIL_SCENARIO_ID,
    courseStatus: COURSE_STATUSES.PUBLISHED,
    expectedStatus: 401,
    expectedMessage: "phishing.unavailable",
  },
  {
    title: "a plain http tracking link outside local development",
    signedRequest: SIGNED_REQUEST_KINDS.VALID,
    trackingUrl: "http://tracker.example.com/t/abc123",
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    scenarioId: EMAIL_SCENARIO_ID,
    courseStatus: COURSE_STATUSES.PUBLISHED,
    expectedStatus: 400,
    expectedMessage: "phishing.invalidCampaign",
  },
  {
    title: "a tracking link carrying credentials",
    signedRequest: SIGNED_REQUEST_KINDS.VALID,
    trackingUrl: "https://user:secret@tracker.example.com/t/abc123",
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    scenarioId: EMAIL_SCENARIO_ID,
    courseStatus: COURSE_STATUSES.PUBLISHED,
    expectedStatus: 400,
    expectedMessage: "phishing.invalidCampaign",
  },
  {
    title: "a learner who is not a campaign recipient",
    signedRequest: SIGNED_REQUEST_KINDS.VALID,
    trackingUrl: TRUSTED_TRACKING_URL,
    recipient: CAMPAIGN_RECIPIENT_STATES.ABSENT,
    scenarioId: EMAIL_SCENARIO_ID,
    courseStatus: COURSE_STATUSES.PUBLISHED,
    expectedStatus: 401,
    expectedMessage: "phishing.unavailable",
  },
  {
    title: "a scenario without a built-in email",
    signedRequest: SIGNED_REQUEST_KINDS.VALID,
    trackingUrl: TRUSTED_TRACKING_URL,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    scenarioId: UNKNOWN_SCENARIO_ID,
    courseStatus: COURSE_STATUSES.PUBLISHED,
    expectedStatus: 401,
    expectedMessage: "phishing.unavailable",
  },
  {
    title: "a campaign course that is no longer published",
    signedRequest: SIGNED_REQUEST_KINDS.VALID,
    trackingUrl: TRUSTED_TRACKING_URL,
    recipient: CAMPAIGN_RECIPIENT_STATES.CLICKED,
    scenarioId: EMAIL_SCENARIO_ID,
    courseStatus: COURSE_STATUSES.DRAFT,
    expectedStatus: 400,
    expectedMessage: "phishing.invalidCourse",
  },
] as const;
