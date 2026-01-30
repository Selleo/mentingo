import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const createMagicLinkSchema = Type.Object({
  email: Type.String(),
});

export const createMagicLinkResponseSchema = Type.Object({
  message: Type.String(),
});

export const verifyMagicLinkResponseSchema = Type.Object({
  message: Type.String(),
});

export type CreateMagicLinkBody = Static<typeof createMagicLinkSchema>;
export type CreateMagicLinkResponse = Static<typeof createMagicLinkResponseSchema>;
export type VerifyMagicLinkResponse = Static<typeof verifyMagicLinkResponseSchema>;
