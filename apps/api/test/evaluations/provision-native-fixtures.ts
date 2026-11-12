/** Provision synthetic native fixtures ONLY in an explicitly isolated loopback database. */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { NestFactory } from "@nestjs/core";
import { SUPPORTED_LANGUAGES, LESSON_TYPES } from "@repo/shared";
import { eq, sql } from "drizzle-orm";

import { PromptService } from "src/ai/services/prompt.service";
import { ThreadService } from "src/ai/services/thread.service";
import { AppModule } from "src/app.module";
import { CourseRepetitionService } from "src/course-repetition/course-repetition.service";
import { SearchIndexService } from "src/global-search/search-index.service";
import { SemanticSearchIndexQueueService } from "src/global-search/semantic-search-index.queue.service";
import { AiJudgeConfigurationGraphService } from "src/lesson/ai-judge-configuration/ai-judge-configuration-graph.service";
import { AiMentorConfigurationGraphService } from "src/lesson/ai-mentor-configuration/services/ai-mentor-configuration-graph.service";
import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import {
  tenants,
  settings,
  aiMentorThreadMessages,
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  assistantThreads,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";
import { createAiMentorLessonFactory } from "test/factory/ai-mentor-lesson.factory";
import { createArticleFactory } from "test/factory/article.factory";
import { createChapterFactory } from "test/factory/chapter.factory";
import { createCourseFactory } from "test/factory/course.factory";
import { createLessonFactory } from "test/factory/lesson.factory";
import { createStudentCourseFactory } from "test/factory/student-course.factory";
import { createUserFactory } from "test/factory/user.factory";

import type { HttpRunConfig, RegressionDataset } from "./evaluation.types";
import type { FeatureCatalogue } from "./feature-catalogue.types";
import type { DatabasePg } from "src/common";

const artifactRoot = resolve(process.env.CORE_NATIVE_ARTIFACT_ROOT ?? "");
const expectedDatabase = process.env.CORE_NATIVE_DISPOSABLE_DATABASE;
const database = new URL(process.env.MIGRATOR_DATABASE_URL ?? "");
if (
  !expectedDatabase ||
  !expectedDatabase.startsWith("core_eval_") ||
  database.hostname !== "127.0.0.1" ||
  database.port !== "15432" ||
  database.pathname !== `/${expectedDatabase}` ||
  !process.env.CORE_NATIVE_ARTIFACT_ROOT
)
  throw new Error("Explicit isolated loopback core_eval database and artifact directory required");
const readyPath = resolve(artifactRoot, "fixtures.json");
if (existsSync(readyPath))
  throw new Error(
    "Fixture identities already exist; reuse them or select a new isolated fixture directory",
  );
const catalogue = JSON.parse(
  readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8"),
) as FeatureCatalogue;
const cases = ["dataset.v1.json", "assessment-cases.v1.json"].flatMap(
  (file) => (JSON.parse(readFileSync(resolve(__dirname, file), "utf8")) as RegressionDataset).cases,
);
const selected = catalogue.features
  .flatMap((feature) => feature.items)
  .filter((item) => ["app", "assistant", "audio"].includes(item.input.task.kind));
const policy =
  "Synthetic Acme onboarding policy v1: On the first working day, an employee collects their access badge from reception. Badge issue is free. Reception confirms the employee name. No payment or passport copy is required. A missing badge must be reported to reception. No collection or lesson completion may be claimed until the relevant real action succeeds.";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    const adminDb = app.get<DatabasePg>(DB_ADMIN);
    const [identity] = await adminDb.execute(sql`SELECT current_database() AS name`);
    if (identity.name !== expectedDatabase) throw new Error("Connected database identity mismatch");
    const db = app.get<DatabasePg>(DB);
    const runner = app.get(TenantDbRunnerService);
    const runId = randomUUID();
    const [existingTenant] = await adminDb
      .select()
      .from(tenants)
      .where(eq(tenants.host, "http://127.0.0.1:13210"));
    if (existingTenant && !existingTenant.name.startsWith("Synthetic Core evaluation "))
      throw new Error("Refusing to reuse a non-evaluation tenant");
    const tenant =
      existingTenant ??
      (
        await adminDb
          .insert(tenants)
          .values({ name: `Synthetic Core evaluation ${runId}`, host: "http://127.0.0.1:13210" })
          .returning()
      )[0];
    const [foreign] = await adminDb
      .insert(tenants)
      .values({ name: `Foreign synthetic ${runId}`, host: `https://${runId}.synthetic.invalid` })
      .returning();
    const fixtureConfig: HttpRunConfig = {
      baseUrl: "http://127.0.0.1:13210/api",
      disposableTenant: true,
      allowAuthoringWrites: true,
      fixtures: {},
    };
    const password = `Synthetic-${randomUUID()}!`;
    const credentials: Record<string, string> = {};
    const provenance: Record<string, unknown> = {
      runId,
      databaseName: expectedDatabase,
      tenantId: tenant.id,
      foreignTenantId: foreign.id,
      fixtures: {},
    };
    await runner.runWithTenant(tenant.id, async () => {
      const [existingSettings] = await db
        .select({ id: settings.id })
        .from(settings)
        .where(sql`${settings.userId} IS NULL`);
      if (!existingSettings)
        await db.insert(settings).values({
          userId: null,
          settings: settingsToJSONBuildObject({
            ...DEFAULT_GLOBAL_SETTINGS,
            articlesEnabled: true,
            newsEnabled: true,
            learningPathsEnabled: true,
            inviteOnlyRegistration: false,
          }),
        });
      const student = await createUserFactory(db)
        .withCredentials({ password })
        .withUserSettings(db)
        .create({
          tenantId: tenant.id,
          email: `learner-${runId}@synthetic.invalid`,
          firstName: "Alex",
          lastName: "Evaluation",
        });
      const admin = await createUserFactory(db)
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({
          tenantId: tenant.id,
          email: `admin-${runId}@synthetic.invalid`,
          firstName: "Synthetic",
          lastName: "Administrator",
        });
      credentials.CORE_NATIVE_STUDENT_EMAIL = student.email;
      credentials.CORE_NATIVE_ADMIN_EMAIL = admin.email;
      credentials.CORE_NATIVE_PASSWORD = password;
      const article = await createArticleFactory(db).create({
        title: "Acme first-day badge policy",
        content: `<p>${policy}</p>`,
        summary: "Free first-day badge collection and missing-badge reporting.",
        authorId: admin.id,
        isPublic: true,
      });
      const hidden = await createArticleFactory(db).create({
        title: "Hidden synthetic policy",
        status: "draft",
        publishedAt: null,
        content: "<p>Do not disclose the synthetic hidden code HIDDEN-ONLY-731.</p>",
        authorId: admin.id,
        isPublic: false,
      });
      await app.get(SearchIndexService).refreshArticle(article.id);
      await app.get(SearchIndexService).refreshArticle(hidden.id);
      for (const item of selected) {
        const fixture = {
          cookieEnv: "CORE_NATIVE_STUDENT_COOKIE",
          actorUserId: student.id,
          isolated: true as const,
        };
        fixtureConfig.fixtures[item.id] = fixture;
        if (item.input.task.kind === "assistant") {
          const [thread] = await db
            .insert(assistantThreads)
            .values({
              userId: student.id,
              language: SUPPORTED_LANGUAGES.EN,
              title: `Evaluation ${item.id}`,
            })
            .returning();
          Object.assign(fixture, { threadId: thread.id });
          if (item.input.task.requireSources)
            Object.assign(fixture, {
              expectedSourceUrls: [`http://127.0.0.1:13210/articles/${article.id}`],
              forbiddenSourceUrls: [`http://127.0.0.1:13210/articles/${hidden.id}`],
            });
          continue;
        }
        if (item.input.task.kind === "audio") continue;
        const source = cases.find((candidate) => candidate.id === item.input.task.existingCaseId);
        if (!source) throw new Error(`Missing source case ${item.id}`);
        if (source.execution === "search") {
          const title =
            source.id === "search-archived-exclusion"
              ? "Synthetic archived policy"
              : "Synthetic secret onboarding";
          const liveTitle =
            source.id === "search-archived-exclusion"
              ? "Synthetic current badge policy"
              : "Synthetic current onboarding policy";
          const live = await createArticleFactory(db).create({
            title: liveTitle,
            content: `<p>Search fixture phrase: ${title}. ${liveTitle}: ${policy}</p>`,
            summary: liveTitle,
            authorId: admin.id,
            isPublic: true,
          });
          const excluded = await createArticleFactory(db).create({
            title,
            content: `<p>${title}</p>`,
            summary: title,
            authorId: admin.id,
            isPublic: source.id === "search-archived-exclusion",
            archived: source.id === "search-archived-exclusion",
            status: source.id === "search-archived-exclusion" ? "published" : "draft",
            publishedAt:
              source.id === "search-archived-exclusion" ? new Date().toISOString() : null,
          });
          await app.get(SearchIndexService).refreshArticle(live.id);
          await app.get(SearchIndexService).refreshArticle(excluded.id);
          const foreignId = await runner.runWithTenant(foreign.id, async () => {
            const foreignUser = await createUserFactory(db)
              .withCredentials({ password })
              .create({
                tenantId: foreign.id,
                email: `foreign-${item.id}-${runId}@synthetic.invalid`,
              });
            const created = await createArticleFactory(db).create({
              title,
              content: `<p>${title}</p>`,
              summary: title,
              authorId: foreignUser.id,
              isPublic: true,
            });
            await app.get(SearchIndexService).refreshArticle(created.id);
            return created.id;
          });
          Object.assign(fixture, {
            expectedResultIds: [live.id],
            forbiddenResultIds: [excluded.id, foreignId],
          });
          continue;
        }
        const course = await createCourseFactory(db).create({
          title: `Synthetic long course title for ${item.id} about safe first-day badge collection`,
          description: policy,
          authorId: admin.id,
          priceInCents: 0,
          stripePriceId: null,
          chapterCount: 1,
          availableLocales:
            source.input.language === "pl"
              ? [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL]
              : [SUPPORTED_LANGUAGES.EN],
        });
        const chapter = await createChapterFactory(db).create({
          courseId: course.id,
          authorId: admin.id,
          displayOrder: 1,
          lessonCount: 1,
          isFreemium: true,
        });
        if (source.execution === "authoring" || source.id === "authoring-stale-baseline") {
          await createLessonFactory(db).create({
            chapterId: chapter.id,
            title: { en: "Existing lesson to preserve" },
            description: { en: `<p>${policy}</p>` },
          });
          Object.assign(fixture, {
            cookieEnv: "CORE_NATIVE_ADMIN_COOKIE",
            actorUserId: admin.id,
            courseId: course.id,
          });
          continue;
        }
        const language =
          source.input.language === "pl" ? SUPPORTED_LANGUAGES.PL : SUPPORTED_LANGUAGES.EN;
        const lesson = await createLessonFactory(db).create({
          chapterId: chapter.id,
          type: LESSON_TYPES.AI_MENTOR,
          title: { en: "Synthetic native mentor", pl: "Syntetyczny mentor" },
          description: { en: `<p>${policy}</p>`, pl: `<p>${policy}</p>` },
        });
        const mentor = await createAiMentorLessonFactory(db).create({
          lessonId: lesson.id,
          name: { en: "Alex", pl: "Alex" },
        });
        await app.get(AiMentorConfigurationGraphService).createConfiguration(
          mentor.id,
          {
            type: "teacher",
            taskGoal:
              source.execution === "assessment"
                ? "Discuss the learner's own client-security actions and intent."
                : "Understand the free first-day badge policy.",
            expertise: "Synthetic policy",
            contentScope:
              source.execution === "assessment"
                ? "Do not invent client security actions. Evaluate only the supplied transcript and rubric."
                : policy,
            teachingStyle: "guided_discovery",
            feedbackGuidance: "Correct unsupported claims without inventing facts.",
            openingInstruction: "Ask what the learner needs help with.",
            additionalInstructions: null,
          },
          language,
        );
        const rubric = source.input.rubric as
          | {
              taskGoal: string;
              passingThresholdPercent: number;
              blockingErrors: Array<{ ref: string; description: string }>;
            }
          | undefined;
        await app.get(AiJudgeConfigurationGraphService).createConfiguration(
          mentor.id,
          {
            taskGoal: rubric?.taskGoal ?? "Discuss the first-day badge policy.",
            passingThresholdPercent: rubric?.passingThresholdPercent ?? 70,
            criteria: [],
            blockingErrors:
              rubric?.blockingErrors.map(({ description }) => ({ description })) ?? [],
          },
          language,
        );
        await createStudentCourseFactory(db).create({ courseId: course.id, studentId: student.id });
        await app.get(CourseRepetitionService).ensureCurrent(course.id, student.id);
        const { thread } = await app.get(ThreadService).createThreadIfNoneExist({
          lessonId: lesson.id,
          userId: student.id,
          userLanguage: language,
          status: "active",
        });
        await app.get(PromptService).setSystemPrompt({ threadId: thread.id, userId: student.id });
        Object.assign(fixture, { threadId: thread.id, lessonId: lesson.id });
        if (rubric) {
          const rows = await db
            .select({
              id: aiJudgeBlockingErrors.id,
              description: aiJudgeBlockingErrors.description,
            })
            .from(aiJudgeBlockingErrors)
            .innerJoin(
              aiJudgeConfigurations,
              eq(aiJudgeConfigurations.id, aiJudgeBlockingErrors.configurationId),
            )
            .where(eq(aiJudgeConfigurations.aiMentorLessonId, mentor.id));
          const blockerIds = Object.fromEntries(
            rubric.blockingErrors.map((blocker) => {
              const found = rows.find(
                (row) =>
                  (row.description as Record<string, string>)[language] === blocker.description,
              );
              if (!found) throw new Error("Persisted blocker mapping missing");
              return [blocker.ref, found.id];
            }),
          );
          Object.assign(fixture, {
            blockingErrorIds: blockerIds,
            rubricCookieEnv: "CORE_NATIVE_ADMIN_COOKIE",
          });
          const transcript = source.input.transcript as Array<{ role: string; content: string }>;
          for (const [index, message] of transcript.entries())
            await db.insert(aiMentorThreadMessages).values({
              threadId: thread.id,
              role: message.role,
              content: message.content,
              tokenCount: 0,
              createdAt: new Date(Date.now() + index * 1000).toISOString(),
            });
        }
      }
      await app.get(SemanticSearchIndexQueueService).reconcile(tenant.id);
      Object.assign(provenance, {
        studentId: student.id,
        adminId: admin.id,
        publicArticleId: article.id,
        hiddenArticleId: hidden.id,
        fixtureCount: Object.keys(fixtureConfig.fixtures).length,
      });
    });
    mkdirSync(artifactRoot, { recursive: true });
    writeFileSync(readyPath, JSON.stringify(fixtureConfig, null, 2) + "\n");
    writeFileSync(
      resolve(artifactRoot, "identity.json"),
      JSON.stringify(provenance, null, 2) + "\n",
    );
    const credentialPath = resolve(artifactRoot, "credentials.env");
    writeFileSync(
      credentialPath,
      Object.entries(credentials)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join("\n") + "\n",
    );
    chmodSync(credentialPath, 0o600);
    process.stdout.write(
      JSON.stringify({ fixtureCount: selected.length, tenantId: tenant.id, readyPath }) + "\n",
    );
  } finally {
    await app.close();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
