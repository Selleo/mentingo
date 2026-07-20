import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const pwaManifestSchema = Type.Object({
  name: Type.String(),
  short_name: Type.String(),
  theme_color: Type.String(),
  background_color: Type.String(),
  display: Type.Literal("standalone"),
  orientation: Type.Literal("portrait"),
  start_url: Type.Literal("/"),
  scope: Type.Literal("/"),
  icons: Type.Array(
    Type.Object({
      src: Type.String(),
      sizes: Type.String(),
      type: Type.String(),
    }),
  ),
});

export type PwaManifest = Static<typeof pwaManifestSchema>;
