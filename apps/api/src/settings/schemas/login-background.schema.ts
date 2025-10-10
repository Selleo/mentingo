import { Type } from "@sinclair/typebox";

export const loginBackgroundResponseSchema = Type.Object({
  url: Type.Union([Type.String(), Type.Null()]),
});
