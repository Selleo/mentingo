import { sql } from "drizzle-orm";

import { users } from "src/storage/schema";

import { getRestrictedIdsCondition, getRestrictedIdsSqlFragment } from "./restrictedIds";

const id = "00000000-0000-0000-0000-000000000001";

describe("restricted ID query helpers", () => {
  it("omits restrictions when the scope is unrestricted", () => {
    expect(getRestrictedIdsCondition(false, [], users.id)).toBeUndefined();
    expect(getRestrictedIdsSqlFragment(false, [], sql.raw("user_id"))).toBeDefined();
  });

  it("returns deny-all expressions for an empty restricted scope", () => {
    expect(getRestrictedIdsCondition(true, [], users.id)).toBeDefined();
    expect(getRestrictedIdsSqlFragment(true, [], sql.raw("user_id"))).toBeDefined();
  });

  it("returns ID filters for a populated restricted scope", () => {
    expect(getRestrictedIdsCondition(true, [id], users.id)).toBeDefined();
    expect(getRestrictedIdsSqlFragment(true, [id], sql.raw("user_id"))).toBeDefined();
  });
});
