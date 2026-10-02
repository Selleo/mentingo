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
export type PhishingConnectionProbeResponse = Static<typeof phishingConnectionProbeResponseSchema>;

export type PhishingConnectionProbe = Static<typeof phishingConnectionProbeSchema>;
