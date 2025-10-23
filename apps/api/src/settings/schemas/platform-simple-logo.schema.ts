import { Type } from "@sinclair/typebox";

export const platformSimpleLogoResponseSchema = Type.Object({
  url: Type.Union([Type.String(), Type.Null()]),
});
