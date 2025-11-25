import { sql } from "drizzle-orm";

import { groupUsers, users } from "src/storage/schema";

import type { GroupsFilterSchema } from "src/group/group.types";

export function getGroupFilterConditions(groups: GroupsFilterSchema) {
  return sql`${users.id} IN (
    SELECT ${groupUsers.userId}
    FROM ${groupUsers}
    WHERE ${groupUsers.groupId} = ANY(ARRAY[${sql.join(
      groups.map((id) => sql`${id}::uuid`),
      sql`, `,
    )}])
    GROUP BY ${groupUsers.userId}
    HAVING COUNT(DISTINCT ${groupUsers.groupId}) = ${groups.length}
  )`;
}
