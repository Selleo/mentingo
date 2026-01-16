import { Type, type Static } from "@sinclair/typebox";

export const courseLookupResponseSchema = Type.Object({
  status: Type.Union([Type.Literal("found"), Type.Literal("redirect")]),
  slug: Type.Optional(Type.String()),
});

export type CourseLookupResponse = Static<typeof courseLookupResponseSchema>;
