import type { InferSelectModel } from "drizzle-orm";
import type { CommonUser } from "src/common/schemas/common-user.schema";
import type { magicLinkTokens } from "src/storage/schema";
import type { UserResponse } from "src/user/schemas/user.schema";

export type TokenUser = (CommonUser | UserResponse) & { tenantId: string };
export type MagicLinkToken = InferSelectModel<typeof magicLinkTokens>;
