import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { COURSE_ENROLLMENT, LESSON_TYPES, PERMISSIONS, RESOURCE_VISIBILITY } from "@repo/shared";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { LocalizationService } from "src/localization/localization.service";
import { McpStudentLessonRepository } from "src/mcp/mcp-student-lesson.repository";
import { dbAls } from "src/storage/db/db-als.store";
import * as schema from "src/storage/schema";

import { SEARCH_ENTITY_TYPES } from "./global-search.constants";
import { GlobalSearchRepository } from "./global-search.repository";
import { HybridSearchRepository } from "./hybrid-search.repository";
import {
  SEMANTIC_SEARCH_INDEX_VERSION,
  SEMANTIC_SEARCH_MODEL,
} from "./semantic-search-index.constants";
import { SemanticSearchIndexQueueService } from "./semantic-search-index.queue.service";
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
      !(
        (url.port === "25436" && url.pathname === "/guidebook") ||
        /^\/mcp_search_[a-f0-9]{12}$/.test(url.pathname)
      )
    ) {
      throw new Error(
        "Search integration requires an isolated loopback #2036 or mcp_search_<12 hex> database",
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

  async function contentFile(
    type: typeof SEARCH_ENTITY_TYPES.ARTICLE | typeof SEARCH_ENTITY_TYPES.NEWS,
    options: {
      scopeTenant?: string;
      visibility?: string;
      relation?: string;
      contentType?: string;
      archived?: boolean;
    } = {},
  ) {
    const scopeTenant = options.scopeTenant ?? tenantId;
    const entityId = randomUUID();
    if (type === SEARCH_ENTITY_TYPES.ARTICLE) {
      const sectionId = randomUUID();
      await fixtureDb.execute(sql`INSERT INTO article_sections (id, tenant_id, title, available_locales)
        VALUES (${sectionId}, ${scopeTenant}, '{"en":"Policies"}'::jsonb, ARRAY['en']::text[])`);
      await fixtureDb.execute(sql`INSERT INTO articles (id, tenant_id, author_id, article_section_id, title, status, published_at, available_locales)
        VALUES (${entityId}, ${scopeTenant}, ${authorId}, ${sectionId}, '{"en":"Expense guidance"}'::jsonb,
          'published', now(), ARRAY['en']::text[])`);
    } else {
      await fixtureDb.execute(sql`INSERT INTO news (id, tenant_id, author_id, title, status, published_at, available_locales)
        VALUES (${entityId}, ${scopeTenant}, ${authorId}, '{"en":"Expense guidance"}'::jsonb,
          'published', now(), ARRAY['en']::text[])`);
    }
    const resourceId = randomUUID();
    await fixtureDb.execute(sql`INSERT INTO resources
      (id, tenant_id, reference, content_type, visibility, uploaded_by_id, archived, metadata)
      VALUES (${resourceId}, ${scopeTenant}, 'fixtures/research-guide.pdf',
        ${options.contentType ?? "application/pdf"}, ${
          options.visibility ?? RESOURCE_VISIBILITY.PUBLIC
        },
        ${authorId}, ${
          options.archived ?? false
        }, '{"originalFilename":"research-guide.pdf"}'::jsonb)`);
    await fixtureDb.execute(sql`INSERT INTO resource_entity (tenant_id, resource_id, entity_type, entity_id, relationship_type)
      VALUES (${scopeTenant}, ${resourceId}, ${type}, ${entityId}, ${
        options.relation ?? "attachment"
      })`);
    return {
      entityId,
      entityType: type,
      documentType: `resource:${resourceId}`,
      language: "en" as const,
      resourceId,
    };
  }

  async function synchronizeAndIndexContentFile(key: Awaited<ReturnType<typeof contentFile>>) {
    const index = new SemanticSearchIndexRepository(fixtureDb);
    await dbAls.run({ tenantId }, async () => {
      await index.synchronizeResourceDocuments();
      const current = await index.findSource(key);
      expect(current).toBeDefined();
      expect(current!.metadata.fileName).toBe("research-guide.pdf");
      expect(
        await index.replace(
          current!,
          ["Reimbursement claims must be submitted within thirty days."],
          [queryVector],
        ),
      ).toBe(true);
    });
    const [saved] = await fixtureDb.execute(
      sql`SELECT metadata, metadata->>'fileName' AS filename FROM search_chunks WHERE entity_id = ${key.entityId}`,
    );
    expect(saved.metadata).toEqual(expect.objectContaining({ fileName: "research-guide.pdf" }));
    expect(saved.filename).toBe("research-guide.pdf");
    return index;
  }

  async function enterTenantRole(scope = tenantId) {
    await fixtureDb.execute(sql.raw(`SET LOCAL ROLE "${role}"`));
    await fixtureDb.execute(sql`SELECT set_config('app.tenant_id', ${scope}, true)`);
  }

  it("filters learner lesson course access before keyword and semantic ranking, regardless of admin permission", async () => {
    actor.permissions.push(PERMISSIONS.COURSE_READ_ASSIGNED);
    await fixtureDb.execute(
      sql`UPDATE lessons SET type = ${LESSON_TYPES.CONTENT} WHERE id = ${lessonId}`,
    );
    await source({
      entityId: lessonId,
      entityType: SEARCH_ENTITY_TYPES.LESSON,
      content: "Curriculumneedle public content",
      chunk: "Curriculumneedle public content",
    });
    const enrolledCourseId = await course("private");
    const hiddenCourseId = await course("private");
    const draftId = await course("draft");
    const archivedId = await course();
    const paidId = await course();
    const enrolledPaidId = await course();
    const negativePriceId = await course();
    await fixtureDb.execute(
      sql`UPDATE courses SET price_in_cents = 2500 WHERE id IN (${paidId}, ${enrolledPaidId})`,
    );
    await fixtureDb.execute(
      sql`UPDATE courses SET price_in_cents = -1 WHERE id = ${negativePriceId}`,
    );
    await fixtureDb.execute(sql`UPDATE courses SET is_archived = true WHERE id = ${archivedId}`);
    let privateLessonId = "";
    let paidLessonId = "";
    const allLessonIds = [lessonId];
    for (const id of [
      enrolledCourseId,
      hiddenCourseId,
      draftId,
      archivedId,
      paidId,
      enrolledPaidId,
      negativePriceId,
    ]) {
      const chapterId = randomUUID();
      const idOfLesson = randomUUID();
      await fixtureDb.execute(
        sql`INSERT INTO chapters (id, tenant_id, course_id, author_id) VALUES (${chapterId}, ${tenantId}, ${id}, ${authorId})`,
      );
      await fixtureDb.execute(
        sql`INSERT INTO lessons (id, tenant_id, chapter_id, type) VALUES (${idOfLesson}, ${tenantId}, ${chapterId}, ${LESSON_TYPES.CONTENT})`,
      );
      await source({
        entityId: idOfLesson,
        entityType: SEARCH_ENTITY_TYPES.LESSON,
        content: "Curriculumneedle private content",
        chunk: "Curriculumneedle private content",
      });
      allLessonIds.push(idOfLesson);
      if (id === enrolledCourseId) privateLessonId = idOfLesson;
      if (id === enrolledPaidId) paidLessonId = idOfLesson;
    }
    await fixtureDb.execute(
      sql`INSERT INTO student_courses (tenant_id, student_id, course_id, status) VALUES (${tenantId}, ${actor.userId}, ${enrolledCourseId}, ${COURSE_ENROLLMENT.ENROLLED}), (${tenantId}, ${actor.userId}, ${enrolledPaidId}, ${COURSE_ENROLLMENT.ENROLLED}), (${tenantId}, ${authorId}, ${hiddenCourseId}, ${COURSE_ENROLLMENT.ENROLLED})`,
    );
    await enterTenantRole();
    const keyword = await repository.findKeywordMatches(
      SEARCH_ENTITY_TYPES.LESSON,
      "Curriculumneedle",
      actor,
      false,
      true,
    );
    const semantic = await repository.findSemanticMatches(
      SEARCH_ENTITY_TYPES.LESSON,
      queryVector,
      actor,
      false,
      true,
    );
    const expected = [lessonId, privateLessonId, paidLessonId].sort();
    for (const matches of [keyword, semantic])
      expect(matches.map((match) => match.entityId).sort()).toEqual(expected);
    const localization = new LocalizationService(fixtureDb);
    const reader = new McpStudentLessonRepository(fixtureDb, localization);
    const hydration = new GlobalSearchRepository(fixtureDb, localization);
    const matches = allLessonIds.map((entityId) => ({
      entityId,
      languages: ["en" as const],
      rank: 1,
    }));
    expect(
      (await reader.listLessons({ language: "en", pageSize: 25 }, actor)).data
        .map((row) => row.id)
        .sort(),
    ).toEqual(expected);
    expect(
      (await hydration.getLearnerLessons(matches, "en", actor)).map((row) => row.id).sort(),
    ).toEqual(expected);
    // A price change must immediately invalidate previously retrieved public matches.
    await fixtureDb.execute(sql`RESET ROLE`);
    await fixtureDb.execute(sql`UPDATE courses SET price_in_cents = 1000 WHERE id = ${courseId}`);
    await enterTenantRole();
    expect(
      (await hydration.getLearnerLessons(matches, "en", actor)).map((row) => row.id).sort(),
    ).toEqual([privateLessonId, paidLessonId].sort());
    expect((await reader.listLessons({ language: "en", lessonId }, actor)).data).toEqual([]);
    await fixtureDb.execute(sql`RESET ROLE`);
    await fixtureDb.execute(sql`UPDATE student_courses SET status = ${COURSE_ENROLLMENT.NOT_ENROLLED}
      WHERE student_id = ${actor.userId} AND course_id = ${enrolledPaidId} AND tenant_id = ${tenantId}`);
    await enterTenantRole();
    const revokedKeyword = await repository.findKeywordMatches(
      SEARCH_ENTITY_TYPES.LESSON,
      "Curriculumneedle",
      actor,
      false,
      true,
    );
    const revokedSemantic = await repository.findSemanticMatches(
      SEARCH_ENTITY_TYPES.LESSON,
      queryVector,
      actor,
      false,
      true,
    );
    for (const matches of [revokedKeyword, revokedSemantic])
      expect(matches.map((row) => row.entityId)).toEqual([privateLessonId]);
    const remaining = await reader.listLessons({ language: "en", pageSize: 25 }, actor);
    expect(remaining.data.map((row) => row.id)).toEqual([privateLessonId]);
    expect(remaining.pagination.totalItems).toBe(1);
    expect((await hydration.getLearnerLessons(matches, "en", actor)).map((row) => row.id)).toEqual([
      privateLessonId,
    ]);
  });

  it("searches only current safe learner chunks and excludes quiz, resource and raw HTML sources", async () => {
    await fixtureDb.execute(
      sql`UPDATE lessons SET type = ${LESSON_TYPES.CONTENT} WHERE id = ${lessonId}`,
    );
    await source({
      entityId: lessonId,
      entityType: SEARCH_ENTITY_TYPES.LESSON,
      content: '<img alt="greater > hiddenattributeneedle"><script>scriptneedle</script>',
      chunk: "Visiblelearnersentence only",
    });
    await source({
      entityId: lessonId,
      entityType: SEARCH_ENTITY_TYPES.LESSON,
      documentType: "title",
      content: "Unindexedrawneedle",
      indexed: false,
    });
    for (const documentType of [
      "question_title:secret",
      "question_description:secret",
      "answer_option:secret",
      "resource:secret",
    ]) {
      await source({
        entityId: lessonId,
        entityType: SEARCH_ENTITY_TYPES.LESSON,
        documentType,
        content: "Quizandfileneedle",
        chunk: "Quizandfileneedle",
      });
    }
    const chapterId = randomUUID();
    const quizId = randomUUID();
    await fixtureDb.execute(
      sql`INSERT INTO chapters (id, tenant_id, course_id, author_id) VALUES (${chapterId}, ${tenantId}, ${courseId}, ${authorId})`,
    );
    await fixtureDb.execute(
      sql`INSERT INTO lessons (id, tenant_id, chapter_id, type, threshold_score) VALUES (${quizId}, ${tenantId}, ${chapterId}, ${LESSON_TYPES.QUIZ}, 50)`,
    );
    await source({
      entityId: quizId,
      entityType: SEARCH_ENTITY_TYPES.LESSON,
      documentType: "description",
      content: "Quizandfileneedle",
      chunk: "Quizandfileneedle",
    });
    await enterTenantRole();
    for (const query of [
      "hiddenattributeneedle",
      "scriptneedle",
      "Unindexedrawneedle",
      "Quizandfileneedle",
    ]) {
      expect(
        await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, query, actor, false, true),
      ).toEqual([]);
    }
    expect(
      (
        await repository.findKeywordMatches(
          SEARCH_ENTITY_TYPES.LESSON,
          "Visiblelearnersentence",
          actor,
          false,
          true,
        )
      ).map((row) => row.entityId),
    ).toEqual([lessonId]);
    const semantic = await repository.findSemanticMatches(
      SEARCH_ENTITY_TYPES.LESSON,
      queryVector,
      actor,
      false,
      true,
    );
    expect(semantic.map((row) => row.entityId)).toEqual([lessonId]);
    expect(semantic[0].matchedPassage).toBe("Visiblelearnersentence only");
  });

  it("previews unmaterialized file sources without writes and deduplicates indexed source identities", async () => {
    const article = await contentFile(SEARCH_ENTITY_TYPES.ARTICLE);
    const newsFile = await contentFile(SEARCH_ENTITY_TYPES.NEWS);
    await contentFile(SEARCH_ENTITY_TYPES.NEWS, { scopeTenant: otherTenantId });
    const index = new SemanticSearchIndexRepository(fixtureDb);
    const queue = { getQueue: jest.fn(), enqueue: jest.fn() };
    const service = new SemanticSearchIndexQueueService(index, queue as never);
    await dbAls.run({ tenantId }, async () => {
      expect(await service.reconcile(tenantId, { dryRun: true, limit: 50 })).toEqual({
        pending: 2,
        enqueued: 0,
      });
      expect(await index.previewPendingCount(1)).toBe(1);
      expect(await index.previewPendingCount(1, 1)).toBe(1);
      expect(await index.previewPendingCount(1, 2)).toBe(0);
    });
    expect(await fixtureDb.execute(sql`SELECT id FROM search_documents`)).toEqual([]);
    expect(queue.getQueue).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
    await dbAls.run({ tenantId }, async () => {
      await index.synchronizeResourceDocuments();
      // Stored pending sources and canonical file sources are the same two identities.
      expect(await index.previewPendingCount(50)).toBe(2);
    });
    await synchronizeAndIndexContentFile(article);
    await synchronizeAndIndexContentFile(newsFile);
    expect(await dbAls.run({ tenantId }, () => index.previewPendingCount(50))).toBe(0);
  });

  it("removes managed file sources for archived article/news parents without recreating them or deleting body content", async () => {
    const article = await contentFile(SEARCH_ENTITY_TYPES.ARTICLE);
    const newsFile = await contentFile(SEARCH_ENTITY_TYPES.NEWS);
    const index = await synchronizeAndIndexContentFile(article);
    await synchronizeAndIndexContentFile(newsFile);
    await source({
      entityId: article.entityId,
      entityType: SEARCH_ENTITY_TYPES.ARTICLE,
      documentType: "content",
      indexed: false,
      content: "Parent body retained",
    });
    await fixtureDb.execute(
      sql`UPDATE articles SET archived = true WHERE id = ${article.entityId}`,
    );
    await fixtureDb.execute(sql`UPDATE news SET archived = true WHERE id = ${newsFile.entityId}`);
    await dbAls.run({ tenantId }, async () => {
      await index.synchronizeResourceDocuments();
      await index.synchronizeResourceDocuments();
      await index.cleanupDeleted();
      expect(await index.findSource(article)).toBeUndefined();
      expect(await index.findSource(newsFile)).toBeUndefined();
    });
    expect(
      await fixtureDb.execute(
        sql`SELECT id FROM search_documents WHERE document_type LIKE 'resource:%'`,
      ),
    ).toEqual([]);
    expect(await fixtureDb.execute(sql`SELECT id FROM search_chunks`)).toEqual([]);
    const body = await fixtureDb.execute(
      sql`SELECT content FROM search_documents WHERE entity_id = ${article.entityId} AND document_type = 'content'`,
    );
    expect(body[0].content).toBe("Parent body retained");
  });

  it("discovers article/news attachments and inline content files without existing search documents", async () => {
    const files = await Promise.all([
      contentFile(SEARCH_ENTITY_TYPES.ARTICLE),
      contentFile(SEARCH_ENTITY_TYPES.NEWS),
      contentFile(SEARCH_ENTITY_TYPES.ARTICLE, { relation: "content" }),
      contentFile(SEARCH_ENTITY_TYPES.NEWS, { relation: "content" }),
    ]);
    await source({
      entityId: files[0].entityId,
      entityType: SEARCH_ENTITY_TYPES.ARTICLE,
      documentType: "content",
      indexed: false,
      content: "Original article body",
    });
    const index = new SemanticSearchIndexRepository(fixtureDb);
    await dbAls.run({ tenantId }, async () => {
      await index.synchronizeResourceDocuments();
      const pending = await index.findPending(50);
      expect(pending.filter((row) => row.documentType.startsWith("resource:"))).toHaveLength(4);
      for (const file of files) {
        const current = await index.findSource(file);
        expect(current?.resourceReference).toBe("fixtures/research-guide.pdf");
        expect(current?.metadata.resourceId).toBe(file.resourceId);
        expect(current?.content).toContain("research-guide.pdf");
      }
      await index.synchronizeResourceDocuments();
    });
    const body = await fixtureDb.execute(
      sql`SELECT content FROM search_documents WHERE entity_id = ${files[0].entityId} AND document_type = 'content'`,
    );
    expect(body[0].content).toBe("Original article body");
    const discovered = await fixtureDb.execute(
      sql`SELECT entity_id FROM search_documents WHERE document_type LIKE 'resource:%'`,
    );
    expect(discovered).toHaveLength(4);
  });

  it.each([SEARCH_ENTITY_TYPES.ARTICLE, SEARCH_ENTITY_TYPES.NEWS])(
    "retrieves chunk-only keyword and semantic passages from %s files",
    async (type) => {
      actor.permissions = [PERMISSIONS.ARTICLE_READ_PUBLIC, PERMISSIONS.NEWS_READ_PUBLIC];
      const file = await contentFile(type, { relation: "content" });
      const index = await synchronizeAndIndexContentFile(file);
      const pending = await dbAls.run({ tenantId }, () => index.findPending(50));
      expect(pending).toEqual([]);
      await enterTenantRole();
      const keyword = await repository.findKeywordMatches(type, "reimb", actor);
      const semantic = await repository.findSemanticMatches(type, queryVector, actor);
      expect(keyword.map((match) => match.entityId)).toEqual([file.entityId]);
      expect(semantic.map((match) => match.entityId)).toEqual([file.entityId]);
      expect(keyword[0].matchedPassage).toContain("thirty days");
      expect(semantic[0].matchedAttachmentFileName).toBe("research-guide.pdf");
      const ordinary = new GlobalSearchRepository(fixtureDb, {} as never);
      expect(await ordinary.findMatches(type, "en", "research")).toEqual([]);
      expect(
        (await repository.findKeywordMatches(type, "research", actor)).map(
          (match) => match.entityId,
        ),
      ).toEqual([file.entityId]);
    },
  );

  it.each([
    [SEARCH_ENTITY_TYPES.ARTICLE, "detach"],
    [SEARCH_ENTITY_TYPES.NEWS, "detach"],
    [SEARCH_ENTITY_TYPES.ARTICLE, "archive"],
    [SEARCH_ENTITY_TYPES.NEWS, "archive"],
  ] as const)(
    "blocks %s file passages after %s and removes their source/chunks",
    async (type, change) => {
      actor.permissions = [PERMISSIONS.ARTICLE_READ_PUBLIC, PERMISSIONS.NEWS_READ_PUBLIC];
      const file = await contentFile(type);
      const index = await synchronizeAndIndexContentFile(file);
      if (change === "detach")
        await fixtureDb.execute(
          sql`DELETE FROM resource_entity WHERE resource_id = ${file.resourceId}`,
        );
      else
        await fixtureDb.execute(
          sql`UPDATE resources SET archived = true WHERE id = ${file.resourceId}`,
        );
      await enterTenantRole();
      expect(await repository.findSemanticMatches(type, queryVector, actor)).toEqual([]);
      expect(await repository.findKeywordMatches(type, "reimb", actor)).toEqual([]);
      await fixtureDb.execute(sql`RESET ROLE`);
      await dbAls.run({ tenantId }, async () => {
        expect(await index.findSource(file)).toBeUndefined();
        await index.synchronizeResourceDocuments();
        await index.cleanupDeleted();
      });
      const rows = await fixtureDb.execute(
        sql`SELECT id FROM search_chunks WHERE entity_id = ${file.entityId}`,
      );
      expect(rows).toEqual([]);
      const docs = await fixtureDb.execute(
        sql`SELECT id FROM search_documents WHERE entity_id = ${file.entityId}`,
      );
      expect(docs).toEqual([]);
    },
  );

  it.each([SEARCH_ENTITY_TYPES.ARTICLE, SEARCH_ENTITY_TYPES.NEWS])(
    "protects private %s file content and permits its uploader",
    async (type) => {
      actor.permissions = [PERMISSIONS.ARTICLE_READ_PUBLIC, PERMISSIONS.NEWS_READ_PUBLIC];
      const file = await contentFile(type, { visibility: RESOURCE_VISIBILITY.PRIVATE });
      await synchronizeAndIndexContentFile(file);
      await enterTenantRole();
      expect(await repository.findSemanticMatches(type, queryVector, actor)).toEqual([]);
      expect(await repository.findKeywordMatches(type, "reimb", actor)).toEqual([]);
      const ordinary = new GlobalSearchRepository(fixtureDb, {} as never);
      expect(await ordinary.findMatches(type, "en", "research")).toEqual([]);
      const owner = { ...actor, userId: authorId };
      expect(
        (await repository.findSemanticMatches(type, queryVector, owner)).map(
          (match) => match.entityId,
        ),
      ).toEqual([file.entityId]);
      expect(
        (await repository.findKeywordMatches(type, "reimb", owner)).map((match) => match.entityId),
      ).toEqual([file.entityId]);
    },
  );

  it.each([SEARCH_ENTITY_TYPES.ARTICLE, SEARCH_ENTITY_TYPES.NEWS])(
    "denies public readers access to files on nonpublic %s parents",
    async (type) => {
      actor.permissions = [PERMISSIONS.ARTICLE_READ_PUBLIC, PERMISSIONS.NEWS_READ_PUBLIC];
      const file = await contentFile(type);
      await synchronizeAndIndexContentFile(file);
      const table = type === SEARCH_ENTITY_TYPES.ARTICLE ? "articles" : "news";
      await fixtureDb.execute(
        sql`UPDATE ${sql.identifier(table)} SET is_public = false WHERE id = ${file.entityId}`,
      );
      await enterTenantRole();
      expect(await repository.findSemanticMatches(type, queryVector, actor)).toEqual([]);
      expect(await repository.findKeywordMatches(type, "reimb", actor)).toEqual([]);
      const ordinary = new GlobalSearchRepository(fixtureDb, {} as never);
      expect(await ordinary.findMatches(type, "en", "research")).toEqual([]);
    },
  );

  it("excludes hidden, archived, unsupported files and cover bindings from discovery", async () => {
    await contentFile(SEARCH_ENTITY_TYPES.ARTICLE, { visibility: RESOURCE_VISIBILITY.HIDDEN });
    await contentFile(SEARCH_ENTITY_TYPES.NEWS, { archived: true });
    await contentFile(SEARCH_ENTITY_TYPES.ARTICLE, { contentType: "image/png" });
    await contentFile(SEARCH_ENTITY_TYPES.NEWS, { relation: "cover_image" });
    const index = new SemanticSearchIndexRepository(fixtureDb);
    await dbAls.run({ tenantId }, () => index.synchronizeResourceDocuments());
    expect(
      await fixtureDb.execute(
        sql`SELECT id FROM search_documents WHERE document_type LIKE 'resource:%'`,
      ),
    ).toEqual([]);
  });

  it("synchronizes only the selected tenant and preserves foreign resource sources under a superuser connection", async () => {
    const own = await contentFile(SEARCH_ENTITY_TYPES.ARTICLE);
    const foreign = await contentFile(SEARCH_ENTITY_TYPES.NEWS, { scopeTenant: otherTenantId });
    const index = new SemanticSearchIndexRepository(fixtureDb);
    await dbAls.run({ tenantId: otherTenantId }, () => index.synchronizeResourceDocuments());
    const [foreignBefore] = await fixtureDb.execute(
      sql`SELECT id, content, updated_at FROM search_documents WHERE tenant_id = ${otherTenantId}`,
    );
    await fixtureDb.execute(
      sql`DELETE FROM resource_entity WHERE resource_id = ${foreign.resourceId}`,
    );
    await dbAls.run({ tenantId }, () => index.synchronizeResourceDocuments());
    const [foreignAfter] = await fixtureDb.execute(
      sql`SELECT id, content, updated_at FROM search_documents WHERE tenant_id = ${otherTenantId}`,
    );
    expect(foreignAfter).toEqual(foreignBefore);
    const pending = await dbAls.run({ tenantId }, () => index.findPending(50));
    expect(pending.map((row) => row.entityId)).toEqual([own.entityId]);
  });

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
