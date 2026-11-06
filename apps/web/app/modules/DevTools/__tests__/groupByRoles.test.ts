import { describe, expect, it } from "vitest";

import { groupByRoles } from "../DevUserSwitcher";

const user = (id: string, roles: string) => ({
  id,
  email: `${id}@example.com`,
  firstName: id,
  lastName: "",
  roles,
});

describe("groupByRoles", () => {
  it("groups users by role set, sorted by group name, with a fallback for no role", () => {
    const groups = groupByRoles([
      user("s1", "student"),
      user("a1", "admin"),
      user("s2", "student"),
      user("n1", ""),
    ]);

    expect(groups.map(([roles, users]) => [roles, users.map(({ id }) => id)])).toEqual([
      ["admin", ["a1"]],
      ["no role", ["n1"]],
      ["student", ["s1", "s2"]],
    ]);
  });
});
