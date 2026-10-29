import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const phishingConnectionProbeSchema = Type.Object(
  {
    tenantId: UUIDSchema,
    nonce: Type.String({ pattern: "^[a-f0-9]{32}$" }),
  },
  { additionalProperties: false },
);

export const phishingConnectionProbeResponseSchema = Type.Object({ nonce: Type.String() });

export const phishingRiskyActionAcknowledgementSchema = Type.Object({
  accepted: Type.Literal(true),
});

export type PhishingConnectionProbe = Static<typeof phishingConnectionProbeSchema>;
export type PhishingConnectionProbeResponse = Static<typeof phishingConnectionProbeResponseSchema>;
export type PhishingRiskyActionAcknowledgement = Static<
  typeof phishingRiskyActionAcknowledgementSchema
>;
