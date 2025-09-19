import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const textExtractionSchema = Type.Array(
  Type.Object({
    pageContent: Type.String(),
    metadata: Type.Object(
      {
        loc: Type.Optional(
          Type.Object(
            {
              pageNumber: Type.Optional(Type.Number()),
            },
            { additionalProperties: true },
          ),
        ),
      },
      { additionalProperties: true },
    ),
    id: Type.Optional(Type.String()),
  }),
);

export const getAllAssignedDocumentsSchema = Type.Array(
  Type.Object({
    id: UUIDSchema,
    name: Type.String(),
    type: Type.String(),
    size: Type.Number(),
  }),
);

export type TextExtractionBody = Static<typeof textExtractionSchema>;
export type GetAllAssignedDocumentsBody = Static<typeof getAllAssignedDocumentsSchema>;
