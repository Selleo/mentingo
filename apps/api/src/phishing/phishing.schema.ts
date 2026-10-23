import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
const nullableDate = Type.Union([Type.String(), Type.Null()]);
export const phishingConfigurationSchema = Type.Object({ enabled: Type.Boolean() });
export const phishingLanguageSchema = Type.Union(
  Object.values(SUPPORTED_LANGUAGES).map((language) => Type.Literal(language)),
);
export const phishingScenarioSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.String(),
  action: Type.Union([Type.Literal("clicked"), Type.Literal("submitted")]),
});
export const phishingCampaignSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  scenarioId: Type.String(),
  courseId: UUIDSchema,
  createdBy: UUIDSchema,
  createdAt: Type.String(),
  status: Type.Union([
    Type.Literal("scheduled"),
    Type.Literal("completed"),
    Type.Literal("cancelled"),
  ]),
  sendWindow: Type.Object({ start: Type.String(), end: Type.String() }),
});
export const createPhishingCampaignSchema = Type.Object(
  {
    requestId: UUIDSchema,
    name: Type.String({ minLength: 1, maxLength: 150 }),
    scenarioId: Type.String({ minLength: 1, maxLength: 100 }),
    courseId: UUIDSchema,
    userIds: Type.Array(UUIDSchema, { maxItems: 10000, uniqueItems: true }),
    groupIds: Type.Array(UUIDSchema, { maxItems: 1000, uniqueItems: true }),
    sendWindow: Type.Object(
      { start: Type.String({ format: "date-time" }), end: Type.String({ format: "date-time" }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export const phishingOptionsSchema = Type.Object({
  users: Type.Array(Type.Object({ id: UUIDSchema, label: Type.String() })),
  groups: Type.Array(
    Type.Object({ id: UUIDSchema, label: Type.String(), userIds: Type.Array(UUIDSchema) }),
  ),
  courses: Type.Array(Type.Object({ id: UUIDSchema, label: Type.String() })),
});
export const phishingRecipientSchema = Type.Object({
  userId: UUIDSchema,
  email: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
  groupIds: Type.Array(UUIDSchema),
  sentAt: nullableDate,
  clickedAt: nullableDate,
  submittedAt: nullableDate,
  failed: Type.Boolean(),
  courseStatus: Type.String(),
});
export const phishingTotalsSchema = Type.Object({
  recipients: Type.Number(),
  sent: Type.Number(),
  clicked: Type.Number(),
  submitted: Type.Number(),
  risky: Type.Number(),
  riskRate: Type.Number(),
});
export const phishingReportActivitySchema = Type.Object({
  userId: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  action: Type.Union([Type.Literal("clicked"), Type.Literal("submitted")]),
  at: Type.String(),
});
export const phishingReportSchema = Type.Object({
  campaign: phishingCampaignSchema,
  /** The action the campaign's scenario counts as risky; click-only scenarios never record submissions. */
  riskyAction: phishingScenarioSchema.properties.action,
  totals: phishingTotalsSchema,
  groups: Type.Array(
    Type.Object({ id: UUIDSchema, name: Type.String(), totals: phishingTotalsSchema }),
  ),
  activity: Type.Array(phishingReportActivitySchema),
});
export const PHISHING_RISKY_ACTIONS = { CLICKED: "clicked", SUBMITTED: "submitted" } as const;
export const PHISHING_REPORT_FILTERS = { ALL: "all", AT_RISK: "atRisk" } as const;
export const PHISHING_REPORT_SORT_FIELDS = ["name", "sentAt", "clickedAt", "submittedAt"] as const;
export const PHISHING_REPORT_MAX_PER_PAGE = 100;
export const phishingReportFilterSchema = Type.Union(
  Object.values(PHISHING_REPORT_FILTERS).map((filter) => Type.Literal(filter)),
);
export const phishingReportSortSchema = Type.Union(
  PHISHING_REPORT_SORT_FIELDS.flatMap((field) => [Type.Literal(field), Type.Literal(`-${field}`)]),
);
export const phishingReportRecipientsQuerySchema = Type.Object({
  search: Type.Optional(Type.String({ maxLength: 200 })),
  groupId: Type.Optional(UUIDSchema),
  filter: Type.Optional(phishingReportFilterSchema),
  sort: Type.Optional(phishingReportSortSchema),
  page: Type.Optional(Type.Number({ minimum: 1 })),
  perPage: Type.Optional(Type.Number({ minimum: 1, maximum: PHISHING_REPORT_MAX_PER_PAGE })),
});
export type CreatePhishingCampaign = Static<typeof createPhishingCampaignSchema>;
export type PhishingReport = Static<typeof phishingReportSchema>;
export type PhishingReportRecipient = Static<typeof phishingRecipientSchema>;
export type PhishingReportRecipientsQuery = Static<typeof phishingReportRecipientsQuerySchema>;
export type PhishingOptions = Static<typeof phishingOptionsSchema>;

export const PHISHING_OPTION_KINDS = {
  USERS: "users",
  GROUPS: "groups",
  COURSES: "courses",
} as const;
export const phishingOptionQuerySchema = Type.Object({
  kind: Type.Union(Object.values(PHISHING_OPTION_KINDS).map((kind) => Type.Literal(kind))),
  language: phishingLanguageSchema,
  search: Type.Optional(Type.String({ maxLength: 200 })),
  page: Type.Integer({ minimum: 1 }),
});
export const phishingOptionPageSchema = Type.Object({
  items: Type.Array(Type.Object({ id: UUIDSchema, label: Type.String() })),
  hasNextPage: Type.Boolean(),
});
export const phishingAudienceSchema = Type.Pick(createPhishingCampaignSchema, [
  "userIds",
  "groupIds",
]);
export const phishingAudienceCountSchema = Type.Object({ count: Type.Integer() });
export type PhishingOptionQuery = Static<typeof phishingOptionQuerySchema>;
export type PhishingAudience = Static<typeof phishingAudienceSchema>;
