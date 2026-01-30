import type { InferSelectModel } from "drizzle-orm";
import type { magicLinkTokens } from "src/storage/schema";

export type MagicLinkToken = InferSelectModel<typeof magicLinkTokens>;
