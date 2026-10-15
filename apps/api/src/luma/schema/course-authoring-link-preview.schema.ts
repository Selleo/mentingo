/** TypeBox contracts for public-page metadata shown behind authoring source citations. */
import { Type, type Static } from "@sinclair/typebox";

const nullableString = (maxLength: number) => Type.Union([Type.String({ maxLength }), Type.Null()]);

export const authoringLinkPreviewQuerySchema = Type.String({
  minLength: 1,
  maxLength: 2048,
});

export const authoringLinkPreviewSchema = Type.Object(
  {
    url: Type.String({ maxLength: 2048 }),
    finalUrl: Type.String({ maxLength: 2048 }),
    domain: Type.String({ maxLength: 255 }),
    title: nullableString(300),
    description: nullableString(600),
    siteName: nullableString(120),
    imageUrl: nullableString(2048),
    faviconUrl: nullableString(2048),
  },
  { additionalProperties: false },
);

export const authoringLinkPreviewResponseSchema = Type.Object({
  data: authoringLinkPreviewSchema,
});

export type AuthoringLinkPreview = Static<typeof authoringLinkPreviewSchema>;
