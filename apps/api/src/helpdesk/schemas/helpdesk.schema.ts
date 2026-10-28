import { SearchMode, SearchQueryMode, TutorialDomain } from "@mentingo/guide-sdk";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { baseResponse } from "src/common";

export const helpdeskDomainSchema = Type.Enum(TutorialDomain);
export const helpdeskTutorialKeySchema = Type.String({
  pattern: "^[a-z0-9][a-z0-9._-]{0,127}$",
});

export const helpdeskSearchRequestSchema = Type.Object(
  {
    query: Type.String({ maxLength: 500, pattern: "^[^\\u0000]*$" }),
    language: Type.Enum(SUPPORTED_LANGUAGES),
    mode: Type.Optional(
      Type.Enum(SearchQueryMode, {
        description: "Keyword uses FTS only; hybrid combines semantic and keyword retrieval.",
      }),
    ),
    pageKey: Type.Optional(Type.String({ pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" })),
    domain: Type.Optional(helpdeskDomainSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
  },
  { additionalProperties: false },
);

export const helpdeskTutorialQuerySchema = Type.Object(
  { language: Type.Enum(SUPPORTED_LANGUAGES) },
  { additionalProperties: false },
);

export const helpdeskChapterSchema = Type.Object(
  {
    id: helpdeskTutorialKeySchema,
    title: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ minLength: 1, maxLength: 4_000 }),
    startMs: Type.Integer({ minimum: 0 }),
    endMs: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const helpdeskTutorialResponseSchema = Type.Object(
  {
    key: helpdeskTutorialKeySchema,
    revisionId: Type.String({
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    }),
    domain: helpdeskDomainSchema,
    title: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ minLength: 1, maxLength: 8_000 }),
    language: Type.String({
      minLength: 2,
      maxLength: 35,
      pattern: "^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$",
    }),
    languageFallback: Type.Boolean(),
    durationMs: Type.Integer({ minimum: 1, maximum: 86_400_000 }),
    videoUrl: Type.String({ maxLength: 2_048 }),
    posterUrl: Type.String({ maxLength: 2_048 }),
    chapters: Type.Array(helpdeskChapterSchema, { minItems: 1, maxItems: 100 }),
    pageKeys: Type.Array(helpdeskTutorialKeySchema, { maxItems: 64 }),
  },
  { additionalProperties: false },
);

export const helpdeskSearchResponseSchema = Type.Object(
  {
    mode: Type.Enum(SearchMode),
    results: Type.Array(
      Type.Object(
        {
          tutorial: helpdeskTutorialResponseSchema,
          chapterId: Type.Optional(Type.Union([helpdeskTutorialKeySchema, Type.Null()])),
          excerpt: Type.String({ maxLength: 10_000 }),
          startMs: Type.Integer({ minimum: 0 }),
          endMs: Type.Integer({ minimum: 0 }),
          rankScore: Type.Number(),
        },
        { additionalProperties: false },
      ),
      { maxItems: 10 },
    ),
  },
  { additionalProperties: false },
);

export const helpdeskDomainsResponseSchema = Type.Array(helpdeskDomainSchema, {
  maxItems: Object.values(TutorialDomain).length,
  uniqueItems: true,
});
export const helpdeskSearchBaseResponseSchema = baseResponse(helpdeskSearchResponseSchema);
export const helpdeskTutorialBaseResponseSchema = baseResponse(helpdeskTutorialResponseSchema);
export const helpdeskDomainsBaseResponseSchema = baseResponse(helpdeskDomainsResponseSchema);

export type HelpdeskSearchRequest = Static<typeof helpdeskSearchRequestSchema>;
export type HelpdeskTutorialQuery = Static<typeof helpdeskTutorialQuerySchema>;
export type HelpdeskSearchResponse = Static<typeof helpdeskSearchResponseSchema>;
export type HelpdeskTutorialResponse = Static<typeof helpdeskTutorialResponseSchema>;
export type HelpdeskDomainsResponse = Static<typeof helpdeskDomainsResponseSchema>;
