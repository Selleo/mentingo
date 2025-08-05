import { Type } from "@sinclair/typebox";

export const platformLogoResponseSchema = Type.Object({
  url: Type.Union([Type.String(), Type.Null()]),
});
