import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const user = Type.Object({
  roleSlug: Type.Enum(SYSTEM_ROLE_SLUGS),
  email: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
});

const userArray = Type.Array(user);

export type UsersSeed = Static<typeof userArray>;
