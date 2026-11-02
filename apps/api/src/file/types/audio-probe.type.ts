import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const audioProbeResultSchema = Type.Object({
  streams: Type.Array(
    Type.Object({
      codec_type: Type.String(),
      codec_name: Type.String(),
      profile: Type.Optional(Type.String()),
    }),
    { minItems: 1 },
  ),
  format: Type.Object({
    format_name: Type.String(),
    duration: Type.String(),
    tags: Type.Optional(Type.Object({ major_brand: Type.Optional(Type.String()) })),
  }),
});

export type AudioProbeResult = Static<typeof audioProbeResultSchema>;
