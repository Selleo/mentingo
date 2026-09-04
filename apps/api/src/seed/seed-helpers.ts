import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TYPE,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  SYSTEM_RULE_SET_SLUGS,
  SUPPORTED_LANGUAGES,
  type SystemRoleSlug,
} from "@repo/shared";
import { and, eq, sql } from "drizzle-orm/sql";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";
import { SearchIndexRepository } from "src/global-search/search-index.repository";
import { SearchIndexService } from "src/global-search/search-index.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  articles,
  categories,
  chapters,
  courses,
  learningPaths,
  lessons,
  news,
  permissionRoleRuleSets,
  permissionRoles,
  permissionRuleSetPermissions,
  permissionRuleSets,
  permissionUserRoles,
  questionAnswerOptions,
  questionsAndAnswers,
  questions,
  tenants,
} from "src/storage/schema";
import { StripeService } from "src/stripe/stripe.service";

import type { DatabasePg, UUIDType } from "../common";
import type { NiceCourseData } from "../utils/types/test-types";

const BLANK_ANSWER_MARKER_REGEX = /<blank-answer-([^>]+)>/g;

type SeedQuestionData = NonNullable<
  NonNullable<NiceCourseData["chapters"][number]["lessons"][number]["questions"]>[number]
>;

type SeedQuestionOption = NonNullable<SeedQuestionData["options"]>[number];

const isFillInTheBlanksQuestion = (questionType: SeedQuestionData["type"]) =>
  questionType === QUESTION_TYPE.FILL_IN_THE_BLANKS_DND ||
  questionType === QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT;

const replaceSeedBlankMarkers = (description: string | undefined, answerIds: UUIDType[]) => {
  if (!description) return description;

  return description.replace(BLANK_ANSWER_MARKER_REGEX, (marker, markerAnswerId: string) => {
    if (!/^\d+$/.test(markerAnswerId)) return marker;

    const answerId = answerIds[Number(markerAnswerId) - 1];
    return answerId ? `<blank-answer-${answerId}>` : marker;
  });
};

const normalizeOptionalString = (value: string | null | undefined) => value ?? undefined;

const buildQuestionAnswerOptionList = (
  questionOptions: SeedQuestionOption[],
  questionId: UUIDType,
  createdAt: string,
  tenantId: UUIDType,
) =>
  questionOptions.map((questionAnswerOption, index) => ({
    id: crypto.randomUUID(),
    createdAt: createdAt,
    updatedAt: createdAt,
    questionId,
    optionText: sql`json_build_object('en', ${questionAnswerOption.optionText}::text)`,
    isCorrect: questionAnswerOption.isCorrect || false,
    displayOrder: index + 1,
    matchedWord: sql`json_build_object('en', ${questionAnswerOption.matchedWord || null}::text)`,
    scaleAnswer: questionAnswerOption.scaleAnswer || null,
    tenantId,
  }));

export async function createNiceCourses(
  creatorUserIds: UUIDType[],
  db: DatabasePg,
  data: NiceCourseData[],
  tenantId: UUIDType,
) {
  const createdCourses = [];

  for (let i = 0; i < data.length; i++) {
    const courseData = data[i];
    const creatorIndex = i % creatorUserIds.length;
    const creatorUserId = creatorUserIds[creatorIndex];

    const [existingCategory] = await db
      .select()
      .from(categories)
      .where(
        and(
          sql`${categories.title}->>${categories.baseLanguage} = ${courseData.category}`,
          eq(categories.tenantId, tenantId),
        ),
      );

    const [category] = existingCategory
      ? [existingCategory]
      : await db
          .insert(categories)
          .values({
            title: buildJsonbField(SUPPORTED_LANGUAGES.EN, courseData.category),
            baseLanguage: SUPPORTED_LANGUAGES.EN,
            availableLocales: [SUPPORTED_LANGUAGES.EN],
            tenantId,
          })
          .returning();

    const createdAt = faker.date.past({ years: 1, refDate: new Date() }).toISOString();

    // --- create stripe product and price ---
    let stripeProductId = null;
    let stripePriceId = null;

    const envService = new EnvService(new EnvRepository(db), new ConfigService());

    const { enabled: isStripeConfigured } = await envService.getStripeConfigured();

    if (isStripeConfigured) {
      const stripeService = new StripeService(envService);

      const existingStripeProduct = await stripeService.searchProducts({
        query: `name:\'${courseData.title}\'`,
      });

      // if product exists, search for price
      if (existingStripeProduct.data.length > 0) {
        const price = await stripeService.searchPrices({
          query: `product:\'${existingStripeProduct.data?.[0].id}\' AND active:\'true\'`,
        });

        stripeProductId = existingStripeProduct.data?.[0]?.id;
        stripePriceId = price.data?.[0]?.id;
      } else {
        // create product and price
        const { productId, priceId } = await stripeService.createProduct({
          name: courseData.title,
          description: courseData.description,
          amountInCents: courseData.priceInCents ? courseData.priceInCents : 0,
          currency: courseData.currency ? courseData.currency : "usd",
        });

        stripeProductId = productId;
        stripePriceId = priceId;
      }
    }

    const [course] = await db
      .insert(courses)
      .values({
        id: crypto.randomUUID(),
        title: sql`json_build_object('en', ${courseData.title}::text)`,
        description: sql`json_build_object('en', ${courseData.description}::text)`,
        thumbnailS3Key: courseData.thumbnailS3Key,
        status: courseData.status,
        priceInCents: courseData.priceInCents,
        chapterCount: courseData.chapters.length,
        hasCertificate: courseData.hasCertificate,
        authorId: creatorUserId,
        categoryId: category.id,
        createdAt: createdAt,
        updatedAt: createdAt,
        stripeProductId,
        stripePriceId,
        tenantId,
      })
      .returning();

    for (const [index, chapterData] of courseData.chapters.entries()) {
      const [chapter] = await db
        .insert(chapters)
        .values({
          id: crypto.randomUUID(),
          title: sql`json_build_object('en', ${chapterData.title}::text)`,
          authorId: creatorUserId,
          courseId: course.id,
          isFreemium: chapterData.isFreemium,
          createdAt: createdAt,
          updatedAt: createdAt,
          displayOrder: index + 1,
          lessonCount: chapterData.lessons.length,
          tenantId,
        })
        .returning();

      for (const [index, lessonData] of chapterData.lessons.entries()) {
        const [lesson] = await db
          .insert(lessons)
          .values({
            id: crypto.randomUUID(),
            title: sql`json_build_object('en', ${lessonData.title}::text)`,
            description: sql`json_build_object('en', ${lessonData.description ?? ""}::text)`,
            type: lessonData.type,
            displayOrder: index + 1,
            fileS3Key: null,
            fileType: null,
            thresholdScore: lessonData.type === LESSON_TYPES.QUIZ ? 0 : null,
            chapterId: chapter.id,
            createdAt: createdAt,
            updatedAt: createdAt,
            tenantId,
          })
          .returning();
        if (
          lessonData.type === LESSON_TYPES.AI_MENTOR &&
          lessonData.additionalInstructions &&
          lessonData.aiJudgeConfiguration
        ) {
          const [aiMentorLesson] = await db
            .insert(aiMentorLessons)
            .values({
              lessonId: lesson.id,
              tenantId,
            })
            .returning();

          const [aiMentorConfiguration] = await db
            .insert(aiMentorConfigurations)
            .values({
              aiMentorLessonId: aiMentorLesson.id,
              type: AI_MENTOR_TYPE.ROLEPLAY,
              additionalInstructions: buildJsonbField(
                SUPPORTED_LANGUAGES.EN,
                lessonData.additionalInstructions,
              ),
              tenantId,
            })
            .returning();

          await db.insert(aiMentorRoleplayConfigurations).values({
            configurationId: aiMentorConfiguration.id,
            difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
            tenantId,
          });

          const [configuration] = await db
            .insert(aiJudgeConfigurations)
            .values({
              aiMentorLessonId: aiMentorLesson.id,
              taskGoal: buildJsonbField(
                SUPPORTED_LANGUAGES.EN,
                lessonData.aiJudgeConfiguration.taskGoal,
              ),
              passingThresholdPercent: lessonData.aiJudgeConfiguration.passingThresholdPercent,
              tenantId,
            })
            .returning();

          for (const criterionData of lessonData.aiJudgeConfiguration.criteria) {
            const [criterion] = await db
              .insert(aiJudgeCriteria)
              .values({
                configurationId: configuration.id,
                title: buildJsonbField(SUPPORTED_LANGUAGES.EN, criterionData.title),
                expectedBehavior: buildJsonbField(
                  SUPPORTED_LANGUAGES.EN,
                  criterionData.expectedBehavior,
                ),
                maxScore: criterionData.maxScore,
                tenantId,
              })
              .returning();

            await db.insert(aiJudgeScoreGuidance).values(
              criterionData.scoreGuidance.map((guidance) => ({
                criterionId: criterion.id,
                score: guidance.score,
                description: buildJsonbField(SUPPORTED_LANGUAGES.EN, guidance.description),
                example: guidance.example
                  ? buildJsonbField(SUPPORTED_LANGUAGES.EN, guidance.example)
                  : undefined,
                tenantId,
              })),
            );
          }

          if (lessonData.aiJudgeConfiguration.blockingErrors.length)
            await db.insert(aiJudgeBlockingErrors).values(
              lessonData.aiJudgeConfiguration.blockingErrors.map((blockingError) => ({
                configurationId: configuration.id,
                description: buildJsonbField(SUPPORTED_LANGUAGES.EN, blockingError.description),
                tenantId,
              })),
            );
        }
        if (lessonData.type === LESSON_TYPES.QUIZ && lessonData.questions) {
          for (const [index, questionData] of lessonData.questions.entries()) {
            const questionId = crypto.randomUUID();
            const questionAnswerOptionList = questionData.options
              ? buildQuestionAnswerOptionList(questionData.options, questionId, createdAt, tenantId)
              : [];
            const correctFillBlankAnswerIds = questionAnswerOptionList
              .filter(({ isCorrect }) => isCorrect)
              .map(({ id }) => id);
            const description = isFillInTheBlanksQuestion(questionData.type)
              ? replaceSeedBlankMarkers(
                  normalizeOptionalString(questionData.description),
                  correctFillBlankAnswerIds,
                )
              : questionData.description;

            await db
              .insert(questions)
              .values({
                id: questionId,
                type: questionData.type,
                title: sql`json_build_object('en', ${questionData.title}::text)`,
                description: sql`json_build_object('en', ${description ?? null}::text)`,
                lessonId: lesson.id,
                authorId: creatorUserId,
                createdAt: createdAt,
                updatedAt: createdAt,
                displayOrder: index + 1,
                solutionExplanation: sql`json_build_object('en', ${
                  questionData.solutionExplanation ?? null
                }::text)`,
                photoS3Key: questionData.photoS3Key ?? null,
                tenantId,
              })
              .returning();

            if (questionAnswerOptionList.length > 0) {
              await db.insert(questionAnswerOptions).values(questionAnswerOptionList);
            }
          }
        }
      }
    }
    createdCourses.push(course);
  }

  return createdCourses;
}

export async function seedTruncateAllTables(db: DatabasePg): Promise<void> {
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);

    const tables = (result as unknown as Record<string, unknown>[]).map(
      (row) => row.tablename as string,
    );

    await tx.execute(sql`SET CONSTRAINTS ALL DEFERRED`);

    for (const table of tables) {
      console.log(`Truncating table ${table}`);
      await tx.execute(sql`TRUNCATE TABLE ${sql.identifier(table)} CASCADE`);
    }

    await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
  });
}

export async function refreshSeedSearchDocuments(db: DatabasePg, tenantId: UUIDType) {
  await db.transaction(async (trx) => {
    await trx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);

    const searchIndexService = new SearchIndexService(new SearchIndexRepository(trx));

    const [courseRows, lessonRows, learningPathRows, newsRows, articleRows, questionAnswerRows] =
      await Promise.all([
        trx.select({ id: courses.id }).from(courses).where(eq(courses.tenantId, tenantId)),
        trx.select({ id: lessons.id }).from(lessons).where(eq(lessons.tenantId, tenantId)),
        trx
          .select({ id: learningPaths.id })
          .from(learningPaths)
          .where(eq(learningPaths.tenantId, tenantId)),
        trx.select({ id: news.id }).from(news).where(eq(news.tenantId, tenantId)),
        trx.select({ id: articles.id }).from(articles).where(eq(articles.tenantId, tenantId)),
        trx
          .select({ id: questionsAndAnswers.id })
          .from(questionsAndAnswers)
          .where(eq(questionsAndAnswers.tenantId, tenantId)),
      ]);

    await Promise.all([
      ...courseRows.map((course) => searchIndexService.refreshCourse(course.id, trx)),
      searchIndexService.refreshLessons(
        lessonRows.map((lesson) => lesson.id),
        trx,
      ),
      ...learningPathRows.map((learningPath) =>
        searchIndexService.refreshLearningPath(learningPath.id, trx),
      ),
      ...newsRows.map((newsRow) => searchIndexService.refreshNews(newsRow.id, trx)),
      ...articleRows.map((article) => searchIndexService.refreshArticle(article.id, trx)),
      ...questionAnswerRows.map((questionAnswer) =>
        searchIndexService.refreshQA(questionAnswer.id, trx),
      ),
    ]);

    console.log(
      `🔎 Refreshed search documents for tenant ${tenantId}: ${courseRows.length} courses, ${lessonRows.length} lessons, ${learningPathRows.length} learning paths, ${newsRows.length} news, ${articleRows.length} articles, ${questionAnswerRows.length} Q&A entries`,
    );
  });
}

export async function ensureSeedTenant(
  db: DatabasePg,
  options?: { name?: string; host?: string; isManaging?: boolean },
) {
  const host = options?.host ?? "seed.local";
  const name = options?.name ?? "Seed Tenant";
  const isManaging = options?.isManaging ?? false;

  const [existing] = await db.select().from(tenants).where(eq(tenants.host, host));
  if (existing) return existing;

  const [createdTenant] = await db
    .insert(tenants)
    .values({
      name,
      host,
      isManaging,
    })
    .returning();

  return createdTenant;
}

export function addEmailSuffix(email: string, suffix?: string) {
  if (!suffix) return email;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local}+${suffix}@${domain}`;
}

export function getTenantEmailSuffix(origin: string) {
  const hostname = new URL(origin).hostname;
  return hostname.split(".")[0] || hostname;
}

const SYSTEM_ROLE_DISPLAY_NAME: Record<SystemRoleSlug, string> = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: "Admin",
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "Content Creator",
  [SYSTEM_ROLE_SLUGS.TRAINER]: "Trainer",
  [SYSTEM_ROLE_SLUGS.GROUP_MANAGER]: "Group Manager",
  [SYSTEM_ROLE_SLUGS.STUDENT]: "Student",
};

export async function seedSystemRolesForTenant(db: DatabasePg, tenantId: UUIDType) {
  for (const roleSlug of Object.values(SYSTEM_ROLE_SLUGS)) {
    const ruleSetSlug = SYSTEM_RULE_SET_SLUGS[roleSlug];
    const permissions = SYSTEM_ROLE_PERMISSIONS[roleSlug];

    const [role] = await db
      .insert(permissionRoles)
      .values({
        tenantId,
        name: SYSTEM_ROLE_DISPLAY_NAME[roleSlug],
        slug: roleSlug,
        isSystem: true,
      })
      .onConflictDoNothing({
        target: [permissionRoles.tenantId, permissionRoles.slug],
      })
      .returning({ id: permissionRoles.id });
    const roleId = role?.id ?? (await findPermissionRoleId(db, tenantId, roleSlug));

    const [ruleSet] = await db
      .insert(permissionRuleSets)
      .values({
        tenantId,
        name: SYSTEM_ROLE_DISPLAY_NAME[roleSlug],
        slug: ruleSetSlug,
        isSystem: true,
      })
      .onConflictDoNothing({
        target: [permissionRuleSets.tenantId, permissionRuleSets.slug],
      })
      .returning({ id: permissionRuleSets.id });
    const ruleSetId = ruleSet?.id ?? (await findPermissionRuleSetId(db, tenantId, ruleSetSlug));

    await db
      .insert(permissionRoleRuleSets)
      .values({
        tenantId,
        roleId,
        ruleSetId,
      })
      .onConflictDoNothing({
        target: [permissionRoleRuleSets.roleId, permissionRoleRuleSets.ruleSetId],
      });

    await db
      .delete(permissionRuleSetPermissions)
      .where(eq(permissionRuleSetPermissions.ruleSetId, ruleSetId));

    if (permissions.length) {
      await db.insert(permissionRuleSetPermissions).values(
        permissions.map((permission) => ({
          tenantId,
          ruleSetId,
          permission,
        })),
      );
    }
  }
}

async function findPermissionRoleId(db: DatabasePg, tenantId: UUIDType, roleSlug: SystemRoleSlug) {
  const [role] = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, roleSlug)))
    .limit(1);

  if (!role) throw new Error(`System role ${roleSlug} was not inserted or found`);

  return role.id;
}

async function findPermissionRuleSetId(db: DatabasePg, tenantId: UUIDType, ruleSetSlug: string) {
  const [ruleSet] = await db
    .select({ id: permissionRuleSets.id })
    .from(permissionRuleSets)
    .where(and(eq(permissionRuleSets.tenantId, tenantId), eq(permissionRuleSets.slug, ruleSetSlug)))
    .limit(1);

  if (!ruleSet) throw new Error(`System rule set ${ruleSetSlug} was not inserted or found`);

  return ruleSet.id;
}

export async function assignSystemRoleToUser(
  db: DatabasePg,
  userId: UUIDType,
  tenantId: UUIDType,
  roleSlug: SystemRoleSlug,
) {
  const [role] = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, roleSlug)))
    .limit(1);

  if (!role) {
    throw new Error(`System role '${roleSlug}' not found for tenant ${tenantId}`);
  }

  await db.delete(permissionUserRoles).where(eq(permissionUserRoles.userId, userId));

  await db.insert(permissionUserRoles).values({
    userId,
    roleId: role.id,
    tenantId,
  });
}

export async function seedSystemRolesForAllTenants(db: DatabasePg) {
  const existingTenants = await db.select({ id: tenants.id }).from(tenants);

  await Promise.all(existingTenants.map((tenant) => seedSystemRolesForTenant(db, tenant.id)));
}

export const seedUserRoleGrantSql = async (db: DatabasePg) => {
  const forceManageDbRole = process.env.SEED_MANAGE_DB_ROLE === "true";

  const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const isNonLocalEnv = ["production", "staging", "test"].includes(process.env.NODE_ENV ?? "");

  const isLocal = !isCi && !isNonLocalEnv;

  if (!isLocal && !forceManageDbRole) {
    console.warn(
      "Skipping DB role management outside local env. Set SEED_MANAGE_DB_ROLE=true to enable.",
    );
    return;
  }

  await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lms_app_user') THEN
          CREATE ROLE lms_app_user
            LOGIN
            PASSWORD 'replace_with_strong_password'
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

  await db.execute(sql`
      DO $$
      BEGIN
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO lms_app_user', current_database());
      END
      $$;
    `);
  await db.execute(sql`GRANT USAGE ON SCHEMA public TO lms_app_user;`);
  await db.execute(
    sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app_user;`,
  );
  await db.execute(sql`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lms_app_user;
    `);
};
