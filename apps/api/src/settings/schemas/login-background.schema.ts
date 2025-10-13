import { type Static, Type } from "@sinclair/typebox";

export const loginBackgroundResponseSchema = Type.Object({
  url: Type.Union([Type.String(), Type.Null()]),
});

export type LoginBackgroundResponseBody = Static<typeof loginBackgroundResponseSchema>;
