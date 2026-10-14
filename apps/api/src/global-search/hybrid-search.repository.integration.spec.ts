import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { COURSE_ENROLLMENT, PERMISSIONS, RESOURCE_VISIBILITY } from "@repo/shared";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { dbAls } from "src/storage/db/db-als.store";
import * as schema from "src/storage/schema";

import { SEARCH_ENTITY_TYPES } from "./global-search.constants";
import { HybridSearchRepository } from "./hybrid-search.repository";
import {
  SEMANTIC_SEARCH_INDEX_VERSION,
  SEMANTIC_SEARCH_MODEL,
} from "./semantic-search-index.constants";
import { SemanticSearchIndexRepository } from "./semantic-search-index.repository";

import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

// This opt-in suite never connects to the normal development/E2E database.
const databaseUrl = process.env.SEARCH_INTEGRATION_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const queryVector = [1, ...Array<number>(1535).fill(0)];

function planIndexes(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const name = typeof record["Index Name"] === "string" ? [record["Index Name"]] : [];
  return [...name, ...Object.values(record).flatMap(planIndexes)];
}

integration("HybridSearchRepository real PostgreSQL integration", () => {
  let client: ReturnType<typeof postgres>;
  let repository: HybridSearchRepository;
  let database: DatabasePg;
  let fixtureDb: DatabasePg;
  let finishTest: () => void;
  let transactionCompletion: Promise<void>;
  let transactionError: unknown;
  const rollbackFixture = new Error("Roll back search integration fixture");
  let actor: CurrentUserType;
  let tenantId: string;
  let otherTenantId: string;
  let authorId: string;
  let categoryId: string;
  let courseId: string;
  let lessonId: string;
  const role = `search_2036_${randomUUID().replaceAll("-", "")}`;

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.port !== "25436" ||
      url.pathname !== "/guidebook"
    ) {
      throw new Error(
        "Search integration requires the isolated local #2036 database on port 25436",
      );
    }
    client = postgres(databaseUrl!, { max: 1, onnotice: () => undefined });
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: resolve(__dirname, "../storage/migrations") });
    // Rollback removes fixtures but leaves dead HNSW entries until vacuum; clean prior suite runs.
    await client.unsafe("VACUUM (ANALYZE) search_chunks");
    await client.unsafe(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await client.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await client.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`);
  }, 120_000);

  beforeEach(async () => {
    transactionError = undefined;
    const finished = new Promise<void>((resolveFinished) => {
      finishTest = resolveFinished;
    });
    let fixtureReady: () => void;
    let fixtureFailed: (error: unknown) => void;
    const ready = new Promise<void>((resolveReady, rejectReady) => {
      fixtureReady = resolveReady;
      fixtureFailed = rejectReady;
    });
    transactionCompletion = database
      .transaction(async (trx) => {
        fixtureDb = trx as unknown as DatabasePg;
        repository = new HybridSearchRepository(fixtureDb);
        try {
          await setupFixture();
          fixtureReady();
          await finished;
        } catch (error) {
          fixtureFailed(error);
          throw error;
        }
        throw rollbackFixture;
      })
      .catch((error: unknown) => {
        if (error !== rollbackFixture) transactionError = error;
      });
    await ready;
  });

  async function setupFixture() {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    authorId = randomUUID();
    categoryId = randomUUID();
    actor = {
      tenantId,
      userId: randomUUID(),
      email: "search@example.test",
      roleSlugs: [],
      permissions: [PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_UPDATE],
    };
    await fixtureDb.execute(sql`INSERT INTO tenants (id, name, host) VALUES
      (${tenantId}, 'Search fixture', ${tenantId}), (${otherTenantId}, 'Other tenant', ${otherTenantId})`);
    await fixtureDb.execute(sql`INSERT INTO users (id, tenant_id, email, first_name, last_name) VALUES
      (${authorId}, ${tenantId}, 'author@example.test', 'Test', 'Author'),
      (${actor.userId}, ${tenantId}, ${actor.email}, 'Test', 'Reader')`);
    await fixtureDb.execute(
      sql`INSERT INTO categories (id, tenant_id, title) VALUES (${categoryId}, ${tenantId}, '{"en":"Search"}'::jsonb)`,
    );
    courseId = await course();
    const chapterId = randomUUID();
    lessonId = randomUUID();
    await fixtureDb.execute(
      sql`INSERT INTO chapters (id, tenant_id, course_id, author_id) VALUES (${chapterId}, ${tenantId}, ${courseId}, ${authorId})`,
    );
    await fixtureDb.execute(
      sql`INSERT INTO lessons (id, tenant_id, chapter_id, type) VALUES (${lessonId}, ${tenantId}, ${chapterId}, 'text')`,
    );
  }

  afterEach(async () => {
    finishTest?.();
    await transactionCompletion;
    if (transactionError) throw transactionError;
  });
  afterAll(async () => {
    if (!client) return;
    await client.unsafe(`DROP OWNED BY "${role}"`);
    await client.unsafe(`DROP ROLE "${role}"`);
    await client.end();
  });

  async function course(status = "published", scopeTenant = tenantId): Promise<string> {
    const id = randomUUID();
    await fixtureDb.execute(sql`INSERT INTO courses (id, tenant_id, author_id, category_id, settings, status, available_locales)
      VALUES (${id}, ${scopeTenant}, ${authorId}, ${categoryId}, '{}'::jsonb, ${status}, ARRAY['en']::text[])`);
    return id;
  }

  async function source(
    options: {
      entityId?: string;
      entityType?: string;
      content?: string;
      chunk?: string;
      language?: string;
      resourceId?: string;
      model?: string;
      version?: number;
      indexed?: boolean;
      scopeTenant?: string;
      documentType?: string;
    } = {},
  ) {
    const entityId = options.entityId ?? courseId;
    const entityType = options.entityType ?? SEARCH_ENTITY_TYPES.COURSE;
    const content = options.content ?? "Travel expense policy";
    const chunk =
      options.chunk ?? "Employees may claim the cost of business travel within thirty days.";
    const language = options.language ?? "en";
    const documentType =
      options.documentType ??
      (options.resourceId ? `resource:${options.resourceId}` : "description");
    const scopeTenant = options.scopeTenant ?? tenantId;
    const metadata = options.resourceId
      ? { resourceId: options.resourceId, fileName: "policy.pdf" }
      : {};
    await fixtureDb.execute(sql`INSERT INTO search_documents (tenant_id, entity_type, entity_id, document_type, language, content, search_vector, metadata)
      VALUES (${scopeTenant}, ${entityType}, ${entityId}, ${documentType}, ${language}, ${content},
        to_tsvector('simple', ${content}), ${JSON.stringify(metadata)}::text::jsonb)`);
    if (options.indexed === false) return;
    let revision = "";
    if (options.resourceId) {
      const [row] =
        await fixtureDb.execute(sql`SELECT md5(coalesce(reference, '') || ':' || updated_at::text || ':' || content_type) AS revision
        FROM resources WHERE id = ${options.resourceId}`);
      revision = String(row.revision);
    }
    await fixtureDb.execute(sql`INSERT INTO search_chunks (tenant_id, entity_type, entity_id, document_type, language,
      chunk_index, content, search_vector, embedding, source_hash, source_revision, embedding_model, index_version, metadata)
      VALUES (${scopeTenant}, ${entityType}, ${entityId}, ${documentType}, ${language}, 0, ${chunk},
        to_tsvector('simple', ${chunk}), ${JSON.stringify(
          queryVector,
        )}::vector, md5(${content}), ${revision},
        ${options.model ?? SEMANTIC_SEARCH_MODEL}, ${
          options.version ?? SEMANTIC_SEARCH_INDEX_VERSION
        }, ${JSON.stringify(metadata)}::text::jsonb)`);
  }

  async function attachment(visibility: string = RESOURCE_VISIBILITY.PUBLIC) {
    const id = randomUUID();
    await fixtureDb.execute(sql`INSERT INTO resources (id, tenant_id, reference, content_type, visibility, uploaded_by_id)
      VALUES (${id}, ${tenantId}, 'fixtures/policy.pdf', 'application/pdf', ${visibility}, ${authorId})`);
    await fixtureDb.execute(sql`INSERT INTO resource_entity (tenant_id, resource_id, entity_type, entity_id, relationship_type)
      VALUES (${tenantId}, ${id}, ${SEARCH_ENTITY_TYPES.LESSON}, ${lessonId}, 'attachment')`);
    await source({ entityId: lessonId, entityType: SEARCH_ENTITY_TYPES.LESSON, resourceId: id });
    return id;
  }

  async function enterTenantRole(scope = tenantId) {
    await fixtureDb.execute(sql.raw(`SET LOCAL ROLE "${role}"`));
    await fixtureDb.execute(sql`SELECT set_config('app.tenant_id', ${scope}, true)`);
  }

  it("retrieves a semantic candidate with no keyword overlap using deterministic vectors", async () => {
    await source();
    await enterTenantRole();
    expect(
      await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.COURSE, "reimbursement", actor),
    ).toEqual([]);
    const matches = await repository.findSemanticMatches(
      SEARCH_ENTITY_TYPES.COURSE,
      queryVector,
      actor,
    );
    expect(matches.map((match) => match.entityId)).toEqual([courseId]);
    expect(matches[0].matchedPassage).toContain("thirty days");
  });

  it("keeps administrative backfill reads inside the selected tenant even with RLS bypass", async () => {
    await source({ indexed: false, content: "Tenant A policy" });
    await source({ indexed: false, scopeTenant: otherTenantId, content: "Tenant B secret policy" });
    const index = new SemanticSearchIndexRepository(fixtureDb);
    const pending = await dbAls.run({ tenantId }, () => index.findPending(50));
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe("Tenant A policy");
  });

  it("keeps administrative cleanup from deleting another tenant's chunks", async () => {
    await source();
    await source({ scopeTenant: otherTenantId });
    await fixtureDb.execute(sql`DELETE FROM search_documents WHERE tenant_id = ${tenantId}`);
    const index = new SemanticSearchIndexRepository(fixtureDb);
    await dbAls.run({ tenantId }, () => index.cleanupDeleted());
    const remaining = await fixtureDb.execute(sql`SELECT tenant_id FROM search_chunks`);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tenant_id).toBe(otherTenantId);
  });

  it("preserves prefix keyword matches and excerpts text late in an attachment", async () => {
    const resourceId = await attachment();
    await fixtureDb.execute(sql`UPDATE search_chunks SET content = ${
      "Introduction without relevant words. ".repeat(80) +
      "Reimbursement must be submitted within thirty days. " +
      "Further explanations. ".repeat(30)
    },
      search_vector = to_tsvector('simple', 'Reimbursement must be submitted within thirty days') WHERE metadata->>'resourceId' = ${resourceId}`);
    await enterTenantRole();
    const [match] = await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, "reimb", actor);
    expect(match.entityId).toBe(lessonId);
    expect(match.matchedPassage).toContain("Reimbursement");
    expect(match.matchedAttachmentFileName).toBe("policy.pdf");
  });

  it("isolates both source and chunk rows with the actual tenant RLS policies", async () => {
    await source();
    const foreignCourseId = await course("published", otherTenantId);
    await source({ entityId: foreignCourseId, scopeTenant: otherTenantId });
    await enterTenantRole();
    const rows = await fixtureDb.execute(sql`SELECT DISTINCT tenant_id FROM search_chunks`);
    expect(rows.map((row) => row.tenant_id)).toEqual([tenantId]);
    expect(
      (await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, queryVector, actor)).map(
        (match) => match.entityId,
      ),
    ).toEqual([courseId]);
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, queryVector, {
        ...actor,
        tenantId: otherTenantId,
      }),
    ).toEqual([]);
  });

  it("keeps archived enrolled courses searchable without exposing unenrolled archived courses", async () => {
    actor.permissions = [PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_READ_ASSIGNED];
    const enrolledCourseId = await course("private");
    const unenrolledCourseId = await course();
    await fixtureDb.execute(sql`UPDATE courses SET is_archived = true
      WHERE id IN (${enrolledCourseId}, ${unenrolledCourseId})`);
    await fixtureDb.execute(sql`INSERT INTO student_courses (tenant_id, student_id, course_id, status)
      VALUES (${tenantId}, ${actor.userId}, ${enrolledCourseId}, ${COURSE_ENROLLMENT.ENROLLED})`);
    await source({ entityId: enrolledCourseId, content: "Archived policy" });
    await source({ entityId: unenrolledCourseId, content: "Archived policy" });
    await enterTenantRole();

    expect(
      (await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.COURSE, "archived", actor)).map(
        (match) => match.entityId,
      ),
    ).toEqual([enrolledCourseId]);
    expect(
      (await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, queryVector, actor)).map(
        (match) => match.entityId,
      ),
    ).toEqual([enrolledCourseId]);
    const catalogReader = { ...actor, permissions: [PERMISSIONS.COURSE_READ] };
    expect(
      await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.COURSE, "archived", catalogReader),
    ).toEqual([]);
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, queryVector, catalogReader),
    ).toEqual([]);
  });

  it("applies course eligibility before the 50-candidate limit", async () => {
    actor.permissions = [PERMISSIONS.COURSE_READ];
    for (let index = 0; index < 55; index++) {
      await source({
        entityId: await course("draft"),
        content: "Reimbursement",
        chunk: "Reimbursement",
      });
    }
    await source({ content: "Reimbursement", chunk: "Reimbursement" });
    await enterTenantRole();
    expect(
      (await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.COURSE, "reimb", actor)).map(
        (match) => match.entityId,
      ),
    ).toEqual([courseId]);
    expect(
      (await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, queryVector, actor)).map(
        (match) => match.entityId,
      ),
    ).toEqual([courseId]);
  });

  it.each(["archive", "detach", "revision"])(
    "blocks stale attachment passages after %s",
    async (change) => {
      const resourceId = await attachment();
      if (change === "archive")
        await fixtureDb.execute(sql`UPDATE resources SET archived = true WHERE id = ${resourceId}`);
      if (change === "detach")
        await fixtureDb.execute(sql`DELETE FROM resource_entity WHERE resource_id = ${resourceId}`);
      if (change === "revision")
        await fixtureDb.execute(
          sql`UPDATE resources SET reference = 'fixtures/replaced.pdf' WHERE id = ${resourceId}`,
        );
      await enterTenantRole();
      expect(
        await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.LESSON, queryVector, actor),
      ).toEqual([]);
      expect(
        await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, "thirty", actor),
      ).toEqual([]);
      if (change !== "revision") {
        expect(
          await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, "policy", actor),
        ).toEqual([]);
      }
    },
  );

  it("hides private passages from other users, allows their owner, and always hides hidden resources", async () => {
    const resourceId = await attachment(RESOURCE_VISIBILITY.PRIVATE);
    await enterTenantRole();
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.LESSON, queryVector, actor),
    ).toEqual([]);
    expect(
      await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, "policy", actor),
    ).toEqual([]);
    expect(await repository.hasCurrentChunks(actor)).toBe(false);
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.LESSON, queryVector, {
        ...actor,
        userId: authorId,
      }),
    ).toHaveLength(1);
    expect(
      await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, "policy", {
        ...actor,
        userId: authorId,
      }),
    ).toHaveLength(1);
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.LESSON, queryVector, {
        ...actor,
        permissions: [...actor.permissions, PERMISSIONS.RESOURCE_LIBRARY_MANAGE],
      }),
    ).toHaveLength(1);
    await fixtureDb.execute(sql`RESET ROLE`);
    await fixtureDb.execute(
      sql`UPDATE resources SET visibility = ${RESOURCE_VISIBILITY.HIDDEN} WHERE id = ${resourceId}`,
    );
    await enterTenantRole();
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.LESSON, queryVector, {
        ...actor,
        permissions: [...actor.permissions, PERMISSIONS.RESOURCE_LIBRARY_MANAGE],
      }),
    ).toEqual([]);
    expect(
      await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, "policy", {
        ...actor,
        permissions: [...actor.permissions, PERMISSIONS.RESOURCE_LIBRARY_MANAGE],
      }),
    ).toEqual([]);
  });

  it("reports incomplete visible-source coverage and excludes incompatible embedding models and versions", async () => {
    await source();
    await source({ entityId: await course(), indexed: false });
    await enterTenantRole();
    expect(await repository.hasCurrentChunks(actor)).toBe(false);
    await fixtureDb.execute(sql`RESET ROLE`);
    await fixtureDb.execute(sql`DELETE FROM search_documents WHERE entity_id <> ${courseId}`);
    await enterTenantRole();
    expect(await repository.hasCurrentChunks(actor)).toBe(true);
    await fixtureDb.execute(sql`RESET ROLE`);
    await fixtureDb.execute(sql`UPDATE search_chunks SET embedding_model = 'different-model'`);
    await enterTenantRole();
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, queryVector, actor),
    ).toEqual([]);
    expect(await repository.hasCurrentChunks(actor)).toBe(false);
    await fixtureDb.execute(sql`RESET ROLE`);
    await fixtureDb.execute(
      sql`UPDATE search_chunks SET embedding_model = ${SEMANTIC_SEARCH_MODEL}, index_version = ${
        SEMANTIC_SEARCH_INDEX_VERSION + 1
      }`,
    );
    await enterTenantRole();
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, queryVector, actor),
    ).toEqual([]);
    expect(await repository.hasCurrentChunks(actor)).toBe(false);
  });

  it("rejects unpublished source-language passages even when the same lesson has a visible-language chunk", async () => {
    await source({ entityId: lessonId, entityType: SEARCH_ENTITY_TYPES.LESSON, language: "en" });
    await source({
      entityId: lessonId,
      entityType: SEARCH_ENTITY_TYPES.LESSON,
      language: "pl",
      chunk: "Hidden translated content",
    });
    await enterTenantRole();
    const [match] = await repository.findSemanticMatches(
      SEARCH_ENTITY_TYPES.LESSON,
      queryVector,
      actor,
    );
    expect(match.languages).toEqual(["en"]);
    expect(match.matchedPassage).not.toContain("Hidden");
  });

  it("uses HNSW and bounds retrieval under selective access and chunk crowding", async () => {
    actor.permissions = [PERMISSIONS.COURSE_READ];
    await fixtureDb.execute(sql`CREATE TEMP TABLE ann_fixtures
      (ordinal integer PRIMARY KEY, entity_id uuid, tenant_id uuid, status text) ON COMMIT DROP`);
    await fixtureDb.execute(sql`INSERT INTO ann_fixtures
      SELECT ordinal, gen_random_uuid(), CASE WHEN ordinal > 50 THEN ${otherTenantId}::uuid ELSE ${tenantId}::uuid END,
        CASE WHEN ordinal > 40 AND ordinal <= 50 THEN 'draft' ELSE 'published' END
      FROM generate_series(1, 60) AS ordinal`);
    await fixtureDb.execute(sql`INSERT INTO courses (id, tenant_id, author_id, category_id, settings, status, available_locales)
      SELECT entity_id, tenant_id, ${authorId}::uuid, ${categoryId}::uuid, '{}'::jsonb,
        status::status, ARRAY['en']::text[] FROM ann_fixtures`);
    await fixtureDb.execute(sql`INSERT INTO search_documents
      (tenant_id, entity_type, entity_id, document_type, language, content, search_vector)
      SELECT tenant_id, ${SEARCH_ENTITY_TYPES.COURSE}, entity_id, 'description', 'en', 'Policy ' || ordinal,
        to_tsvector('simple', 'Policy ' || ordinal) FROM ann_fixtures`);
    // 600 nearest chunks belong to one entity. Inaccessible drafts/foreign tenants are even closer.
    // Spread directions over 16 dimensions. Collinear tiny-angle vectors collapse at float32
    // precision and can produce pathological HNSW graphs unrelated to realistic embeddings.
    await fixtureDb.execute(sql`INSERT INTO search_chunks
      (tenant_id, entity_type, entity_id, document_type, language, chunk_index, content, search_vector,
        embedding, source_hash, source_revision, embedding_model, index_version)
      SELECT f.tenant_id, ${SEARCH_ENTITY_TYPES.COURSE}, f.entity_id, 'description', 'en', n - 1,
        'Policy passage ' || f.ordinal || ':' || n, to_tsvector('simple', 'Policy'),
        ('[1,' || (SELECT string_agg((
          (CASE WHEN f.ordinal > 40 THEN 0.03 + f.ordinal * 0.0005 + n * 0.0001
            WHEN f.ordinal = 1 THEN 0.15 + n * 0.0001
            ELSE 0.25 + f.ordinal * 0.03 + n * 0.0001 END)
          * sin((f.ordinal * 37 + n * 11 + dimension * 13)::double precision) / 4
          )::text, ',' ORDER BY dimension) FROM generate_series(1, 16) AS dimension)
          || repeat(',0', 1519) || ']')::vector,
        md5('Policy ' || f.ordinal), '', ${SEMANTIC_SEARCH_MODEL}, ${SEMANTIC_SEARCH_INDEX_VERSION}
      FROM ann_fixtures f CROSS JOIN LATERAL generate_series(1, CASE WHEN f.ordinal = 1 THEN 600 ELSE 40 END) AS n`);
    await fixtureDb.execute(sql`ANALYZE search_chunks`);
    await fixtureDb.execute(sql`ANALYZE search_documents`);
    await fixtureDb.execute(sql`ANALYZE courses`);
    // Resolve expected fixture IDs before switching to the restricted application role.
    const eligible = await fixtureDb.execute(sql`SELECT entity_id FROM ann_fixtures
      WHERE tenant_id = ${tenantId}::uuid AND status = 'published'`);
    const eligibleIds = new Set(eligible.map((row) => String(row.entity_id)));
    await enterTenantRole();
    await fixtureDb.execute(sql`SELECT set_config('hnsw.ef_search', '200', true),
      set_config('hnsw.iterative_scan', 'strict_order', true)`);
    const productionQuery = repository.buildSemanticCandidateQuery(
      SEARCH_ENTITY_TYPES.COURSE,
      queryVector,
      actor,
      200,
    );
    const normalExplain = await fixtureDb.execute(
      sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${productionQuery}`,
    );
    const normalPlan = normalExplain[0]["QUERY PLAN"];
    expect(planIndexes(normalPlan)).toContain("search_chunks_embedding_hnsw_idx");

    const ann = await repository.findSemanticMatches(
      SEARCH_ENTITY_TYPES.COURSE,
      queryVector,
      actor,
    );
    expect(ann.length).toBeLessThanOrEqual(50);
    expect(new Set(ann.map((row) => row.entityId)).size).toBe(ann.length);
    for (const row of ann) expect(eligibleIds.has(row.entityId)).toBe(true);
  }, 120_000);
});
