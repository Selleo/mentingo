import { ilike, or, sql } from "drizzle-orm";

import { users } from "src/storage/schema";

export function getUserNameSearchCondition(searchQuery: string) {
  const searchPattern = `%${searchQuery}%`;

  return or(
    ilike(users.firstName, searchPattern),
    ilike(users.lastName, searchPattern),
    sql<boolean>`concat(${users.firstName}, ' ', ${users.lastName}) ILIKE ${searchPattern}`,
    sql<boolean>`concat(${users.lastName}, ' ', ${users.firstName}) ILIKE ${searchPattern}`,
  );
}
