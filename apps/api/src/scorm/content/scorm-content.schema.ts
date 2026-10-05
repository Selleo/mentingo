import { Type, type Static } from "@sinclair/typebox";
export const scormRenewSchema = Type.Object(
  { token: Type.String({ pattern: "^[a-f0-9]{64}$" }) },
  { additionalProperties: false },
);
export const scormRenewResponseSchema = Type.Object({ renewed: Type.Boolean() });
export type ScormRenewBody = Static<typeof scormRenewSchema>;
