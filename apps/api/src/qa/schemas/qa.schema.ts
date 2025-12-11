import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const createQASchema = Type.Object({
  title: Type.String(),
  description: Type.String(),

  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export const QAResponseSchema = Type.Object({
  id: UUIDSchema,
  title: Type.Union([Type.String(), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  availableLocales: Type.Array(Type.Enum(SUPPORTED_LANGUAGES)),
});

export const QAUpdateSchema = Type.Partial(
  Type.Object({
    title: Type.String(),
    description: Type.String(),
  }),
);

export const allQAResponseSchema = Type.Array(QAResponseSchema);

export type QAUpdateBody = Static<typeof QAUpdateSchema>;

export type QAResponseBody = Static<typeof QAResponseSchema>;
export type AllQAResponseBody = Static<typeof allQAResponseSchema>;

export type CreateQABody = Static<typeof createQASchema>;
