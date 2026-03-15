import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const user = Type.Object({
  roleSlug: Type.Union([
    Type.Literal(SYSTEM_ROLE_SLUGS.ADMIN),
    Type.Literal(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
    Type.Literal(SYSTEM_ROLE_SLUGS.STUDENT),
  ]),
  email: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
});

const userArray = Type.Array(user);

export type UsersSeed = Static<typeof userArray>;
