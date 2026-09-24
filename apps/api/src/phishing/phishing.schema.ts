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
export const phishingReportSchema = Type.Object({
  campaign: phishingCampaignSchema,
  recipients: Type.Array(phishingRecipientSchema),
  totals: phishingTotalsSchema,
  groups: Type.Array(
    Type.Object({ id: UUIDSchema, name: Type.String(), totals: phishingTotalsSchema }),
  ),
});
export type CreatePhishingCampaign = Static<typeof createPhishingCampaignSchema>;
export type PhishingReport = Static<typeof phishingReportSchema>;
export type PhishingOptions = Static<typeof phishingOptionsSchema>;
