import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import {
  PHISHING_CAMPAIGN_LIMITS,
  PHISHING_CAMPAIGN_STATUSES,
  PHISHING_OPTION_KINDS,
  PHISHING_REPORT_FILTERS,
  PHISHING_REPORT_MAX_PER_PAGE,
  PHISHING_REPORT_SORT_FIELDS,
  PHISHING_RISKY_ACTIONS,
} from "../constants/phishing.constants";

const nullableDateSchema = Type.Union([Type.String(), Type.Null()]);

const phishingOptionSchema = Type.Object({ id: UUIDSchema, label: Type.String() });

export const phishingConfigurationSchema = Type.Object({ enabled: Type.Boolean() });

export const phishingLanguageSchema = Type.Union(
  Object.values(SUPPORTED_LANGUAGES).map((language) => Type.Literal(language)),
);

export const phishingRiskyActionSchema = Type.Union(
  Object.values(PHISHING_RISKY_ACTIONS).map((action) => Type.Literal(action)),
);

export const phishingScenarioSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.String(),
  action: phishingRiskyActionSchema,
});

export const phishingScenariosSchema = Type.Array(phishingScenarioSchema);

export const phishingCampaignSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  scenarioId: Type.String(),
  courseId: UUIDSchema,
  createdBy: UUIDSchema,
  createdAt: Type.String(),
  status: Type.Union(
    Object.values(PHISHING_CAMPAIGN_STATUSES).map((status) => Type.Literal(status)),
  ),
  sendWindow: Type.Object({ start: Type.String(), end: Type.String() }),
});

export const phishingCampaignsSchema = Type.Array(phishingCampaignSchema);

export const createPhishingCampaignSchema = Type.Object(
  {
    requestId: UUIDSchema,
    name: Type.String({ minLength: 1, maxLength: 150 }),
    scenarioId: Type.String({ minLength: 1, maxLength: 100 }),
    courseId: UUIDSchema,
    userIds: Type.Array(UUIDSchema, {
      maxItems: PHISHING_CAMPAIGN_LIMITS.MAX_USERS,
      uniqueItems: true,
    }),
    groupIds: Type.Array(UUIDSchema, {
      maxItems: PHISHING_CAMPAIGN_LIMITS.MAX_GROUPS,
      uniqueItems: true,
    }),
    sendWindow: Type.Object(
      { start: Type.String({ format: "date-time" }), end: Type.String({ format: "date-time" }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const phishingOptionsSchema = Type.Object({
  users: Type.Array(phishingOptionSchema),
  groups: Type.Array(
    Type.Object({ ...phishingOptionSchema.properties, userIds: Type.Array(UUIDSchema) }),
  ),
  courses: Type.Array(phishingOptionSchema),
});

export const phishingRecipientSchema = Type.Object({
  userId: UUIDSchema,
  email: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
  groupIds: Type.Array(UUIDSchema),
  sentAt: nullableDateSchema,
  clickedAt: nullableDateSchema,
  submittedAt: nullableDateSchema,
  failed: Type.Boolean(),
  courseStatus: Type.String(),
});

export const phishingRecipientsSchema = Type.Array(phishingRecipientSchema);

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
  action: phishingRiskyActionSchema,
  at: Type.String(),
});

export const phishingReportSchema = Type.Object({
  campaign: phishingCampaignSchema,
  /** The action the campaign's scenario counts as risky; click-only scenarios never record submissions. */
  riskyAction: phishingRiskyActionSchema,
  totals: phishingTotalsSchema,
  groups: Type.Array(
    Type.Object({ id: UUIDSchema, name: Type.String(), totals: phishingTotalsSchema }),
  ),
  activity: Type.Array(phishingReportActivitySchema),
});

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

export const phishingOptionQuerySchema = Type.Object({
  kind: Type.Union(Object.values(PHISHING_OPTION_KINDS).map((kind) => Type.Literal(kind))),
  language: phishingLanguageSchema,
  search: Type.Optional(Type.String({ maxLength: 200 })),
  page: Type.Integer({ minimum: 1 }),
});

export const phishingOptionPageSchema = Type.Object({
  items: Type.Array(phishingOptionSchema),
  hasNextPage: Type.Boolean(),
});

export const phishingAudienceSchema = Type.Pick(createPhishingCampaignSchema, [
  "userIds",
  "groupIds",
]);

export const phishingAudienceCountSchema = Type.Object({ count: Type.Integer() });

export type PhishingConfiguration = Static<typeof phishingConfigurationSchema>;
export type PhishingScenarios = Static<typeof phishingScenariosSchema>;
export type PhishingCampaign = Static<typeof phishingCampaignSchema>;
export type PhishingCampaigns = Static<typeof phishingCampaignsSchema>;
export type CreatePhishingCampaign = Static<typeof createPhishingCampaignSchema>;
export type PhishingOptions = Static<typeof phishingOptionsSchema>;
export type PhishingReport = Static<typeof phishingReportSchema>;
export type PhishingReportRecipient = Static<typeof phishingRecipientSchema>;
export type PhishingReportRecipients = Static<typeof phishingRecipientsSchema>;
export type PhishingReportRecipientsQuery = Static<typeof phishingReportRecipientsQuerySchema>;
export type PhishingOptionQuery = Static<typeof phishingOptionQuerySchema>;
export type PhishingOptionPage = Static<typeof phishingOptionPageSchema>;
export type PhishingAudience = Static<typeof phishingAudienceSchema>;
export type PhishingAudienceCount = Static<typeof phishingAudienceCountSchema>;
