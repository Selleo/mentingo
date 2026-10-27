import { PERMISSIONS } from "@repo/shared";

import { PermissionsService } from "./permissions.service";

describe("PermissionsService current catalog", () => {
  it("keeps current content grants and excludes obsolete persisted grants without modifying role data", async () => {
    const query = (rows: unknown[]) => ({
      from: () => query(rows),
      innerJoin: () => query(rows),
      where: async () => rows,
    });
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(query([{ roleSlug: "custom-role" }]))
        .mockReturnValueOnce(
          query([
            { permission: "assistant.use" },
            { permission: PERMISSIONS.COURSE_READ },
            { permission: PERMISSIONS.COURSE_READ },
          ]),
        ),
    };
    const service = new PermissionsService(db as never);
    await expect(service.getUserAccess("fixture-user")).resolves.toEqual({
      roleSlugs: ["custom-role"],
      permissions: [PERMISSIONS.COURSE_READ],
    });
  });
});
