import { type Static, Type } from "@sinclair/typebox";

export const ingestionRequestSchema = Type.Array(
  Type.Object({
    file: Type.Object({
      name: Type.String(),
      type: Type.String(),
      size: Type.Number(),
    }),
  }),
);

export type IngestionRequestBody = Static<typeof ingestionRequestSchema>;
