import { PgDialect } from "drizzle-orm/pg-core";

import { CourseTransferGraphRepository } from "./course-transfer-graph.repository";

import type { SQL } from "drizzle-orm";

describe("CourseTransferGraphRepository category identity", () => {
  it("matches the stored base-language title used by the unique index through tenant DB", async () => {
    const category = { id: "existing", title: { en: "Shared category" }, baseLanguage: "en" };
    const limit = jest.fn().mockResolvedValue([category]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const db = { select: jest.fn().mockReturnValue({ from }) };
    const dbAdmin = { select: jest.fn() };
    const courseTransferGraphRepository = new CourseTransferGraphRepository(
      db as never,
      dbAdmin as never,
      {} as never,
    );

    await expect(
      courseTransferGraphRepository.findCategoryByStoredBaseTitle("Shared category"),
    ).resolves.toBe(category);

    const condition = where.mock.calls[0][0] as SQL;
    const query = new PgDialect().sqlToQuery(condition);
    expect(query.sql).toBe('"categories"."title" ->> "categories"."base_language" = $1');
    expect(query.params).toEqual(["Shared category"]);
    expect(limit).toHaveBeenCalledWith(1);
    expect(dbAdmin.select).not.toHaveBeenCalled();
  });

  it("returns no category when the tenant-scoped lookup is empty", async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit }) }),
      }),
    };
    const courseTransferGraphRepository = new CourseTransferGraphRepository(
      db as never,
      {} as never,
      {} as never,
    );

    await expect(
      courseTransferGraphRepository.findCategoryByStoredBaseTitle("Missing category"),
    ).resolves.toBeUndefined();
  });
});
