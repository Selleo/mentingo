import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const phishingEmailRequestSchema = Type.Object(
  {
    tenantId: UUIDSchema,
    campaignId: UUIDSchema,
    userId: UUIDSchema,
    trackingUrl: Type.String({ pattern: "^https?://\\S+$", maxLength: 2048 }),
  },
  { additionalProperties: false },
);

export type PhishingEmailRequest = Static<typeof phishingEmailRequestSchema>;

export const phishingEmailResponseSchema = Type.Object({
  subject: Type.String(),
  html: Type.String(),
  text: Type.String(),
  courseUrl: Type.String(),
  attachments: Type.Array(
    Type.Object({
      filename: Type.String(),
      content: Type.String(),
      contentType: Type.String(),
      cid: Type.String(),
      encoding: Type.Literal("base64"),
    }),
  ),
});

export type PhishingEmailResponse = Static<typeof phishingEmailResponseSchema>;
