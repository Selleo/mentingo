import type { CommonUser } from "src/common/schemas/common-user.schema";
import type { UserResponse } from "src/user/schemas/user.schema";

export type TokenUser = (CommonUser | UserResponse) & { tenantId: string };
