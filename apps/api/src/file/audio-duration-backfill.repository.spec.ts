import { drizzle } from "drizzle-orm/pg-proxy";

import { VideoMetadataRepository } from "./video-metadata.repository";

import type { DatabasePg } from "src/common";

const tenantId = "11111111-1111-4111-8111-111111111111";
const afterId = "22222222-2222-4222-8222-222222222222";

describe("audio duration backfill query", () => {
  it("selects only current tenant live audio without duration using a bounded keyset", async () => {
    const queries: { statement: string; params: unknown[] }[] = [];
    const db = drizzle(async (statement, params) => {
      queries.push({ statement, params });
      return { rows: [] };
    });
    const repository = new VideoMetadataRepository(db as unknown as DatabasePg);
    expect(typeof repository.findAudioMissingDuration).toBe("function");
    await repository.findAudioMissingDuration(tenantId, afterId, 100);
    expect(queries).toHaveLength(1);
    const { statement, params } = queries[0];
    expect(statement).toMatch(/"tenant_id" = \$/);
    expect(statement).toMatch(/"archived" = \$/);
    expect(statement).toMatch(/"content_type" like \$/i);
    expect(statement).toMatch(/->>\s*'durationSeconds'\s+is null/i);
    expect(statement).toMatch(/"id" > \$/);
    expect(statement).toMatch(/order by .*"id" asc/i);
    expect(statement).toMatch(/limit \$/i);
    expect(statement).not.toMatch(/offset/i);
    expect(params).toEqual(expect.arrayContaining([tenantId, false, "audio/%", afterId, 100]));
  });
});
