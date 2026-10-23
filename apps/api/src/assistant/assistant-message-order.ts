import { MESSAGE_ROLE } from "@repo/shared";
import { asc, desc, sql } from "drizzle-orm";

import { assistantMessages } from "src/storage/schema";

/** Equal timestamps must preserve the causal user-before-assistant order, independent of UUIDs. */
export function getAssistantMessageOrder(direction: "asc" | "desc") {
  const order = direction === "desc" ? desc : asc;
  const roleOrder = sql<number>`CASE WHEN ${assistantMessages.role} = ${MESSAGE_ROLE.USER} THEN 0 ELSE 1 END`;
  return [order(assistantMessages.createdAt), order(roleOrder), order(assistantMessages.id)];
}
