import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { and, eq, inArray, sql } from "drizzle-orm/sql";

import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { SYSTEM_ROLE_PERMISSIONS } from "src/permission/permission.constants";
import {
  aiMentorLessons,
  categories,
  chapters,
  courses,
  permissionRoleRuleSets,
  permissionRoles,
  permissionRuleSetPermissions,
  permissionRuleSets,
  permissionUserRoles,
  lessons,
  questionAnswerOptions,
  questions,
  tenants,
} from "src/storage/schema";
import { StripeService } from "src/stripe/stripe.service";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { DatabasePg, UUIDType } from "../common";
import type { NiceCourseData } from "../utils/types/test-types";
import type { PermissionKey } from "src/permission/permission.constants";
import type { UserRole } from "src/user/schemas/userRoles";

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

    await db
      .insert(categories)
      .values({
        id: crypto.randomUUID(),
        title: courseData.category,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId,
      })
      .onConflictDoNothing({
        target: [categories.tenantId, categories.title],
      });

    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.title, courseData.category), eq(categories.tenantId, tenantId)));

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
          lessonData.aiMentorInstructions &&
          lessonData.completionConditions
        ) {
          await db
            .insert(aiMentorLessons)
            .values({
              lessonId: lesson.id,
              aiMentorInstructions: lessonData.aiMentorInstructions,
              completionConditions: lessonData.completionConditions,
              tenantId,
            })
            .returning();
        }
        if (lessonData.type === LESSON_TYPES.QUIZ && lessonData.questions) {
          for (const [index, questionData] of lessonData.questions.entries()) {
            const questionId = crypto.randomUUID();

            await db
              .insert(questions)
              .values({
                id: questionId,
                type: questionData.type,
                title: sql`json_build_object('en', ${questionData.title}::text)`,
                description: sql`json_build_object('en', ${
                  questionData.description ?? null
                }::text)`,
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

            if (questionData.options) {
              const questionAnswerOptionList = questionData.options.map(
                (questionAnswerOption, index) => ({
                  id: crypto.randomUUID(),
                  createdAt: createdAt,
                  updatedAt: createdAt,
                  questionId,
                  optionText: sql`json_build_object('en', ${questionAnswerOption.optionText}::text)`,
                  isCorrect: questionAnswerOption.isCorrect || false,
                  displayOrder: index + 1,
                  matchedWord: sql`json_build_object('en', ${
                    questionAnswerOption.matchedWord || null
                  }::text)`,
                  scaleAnswer: questionAnswerOption.scaleAnswer || null,
                  tenantId,
                }),
              );

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

export async function ensureSeedPermissionData(database: DatabasePg, tenantId: UUIDType) {
  const roleValues = Object.values(USER_ROLES) as UserRole[];

  for (const roleSlug of roleValues) {
    const roleName = getRoleDisplayName(roleSlug);
    const ruleSetSlug = `${roleSlug}-default`;

    await database
      .insert(permissionRoles)
      .values({
        name: roleName,
        slug: roleSlug,
        description: `${roleName} system role`,
        isSystem: true,
        tenantId,
      })
      .onConflictDoNothing({
        target: [permissionRoles.tenantId, permissionRoles.slug],
      });

    await database
      .insert(permissionRuleSets)
      .values({
        name: `${roleName} Default`,
        slug: ruleSetSlug,
        description: `${roleName} default permissions`,
        isSystem: true,
        tenantId,
      })
      .onConflictDoNothing({
        target: [permissionRuleSets.tenantId, permissionRuleSets.slug],
      });
  }

  const roles = await database
    .select({
      id: permissionRoles.id,
      slug: permissionRoles.slug,
    })
    .from(permissionRoles)
    .where(and(eq(permissionRoles.tenantId, tenantId), inArray(permissionRoles.slug, roleValues)));

  const ruleSets = await database
    .select({
      id: permissionRuleSets.id,
      slug: permissionRuleSets.slug,
    })
    .from(permissionRuleSets)
    .where(
      and(
        eq(permissionRuleSets.tenantId, tenantId),
        inArray(
          permissionRuleSets.slug,
          roleValues.map((roleSlug) => `${roleSlug}-default`),
        ),
      ),
    );

  const roleMap = Object.fromEntries(roles.map((role) => [role.slug, role.id])) as Record<
    UserRole,
    UUIDType
  >;
  const ruleSetMap = Object.fromEntries(
    ruleSets.map((ruleSet) => [ruleSet.slug, ruleSet.id]),
  ) as Record<string, UUIDType>;

  for (const roleSlug of roleValues) {
    const roleId = roleMap[roleSlug];
    const ruleSetId = ruleSetMap[`${roleSlug}-default`];

    if (!roleId || !ruleSetId) continue;

    await database
      .insert(permissionRoleRuleSets)
      .values({
        roleId,
        ruleSetId,
        tenantId,
      })
      .onConflictDoNothing({
        target: [permissionRoleRuleSets.roleId, permissionRoleRuleSets.ruleSetId],
      });

    const permissions = (SYSTEM_ROLE_PERMISSIONS[roleSlug] ?? []) as PermissionKey[];
    if (!permissions.length) continue;

    await database
      .insert(permissionRuleSetPermissions)
      .values(
        permissions.map((permission) => ({
          ruleSetId,
          permission,
          tenantId,
        })),
      )
      .onConflictDoNothing({
        target: [
          permissionRuleSetPermissions.ruleSetId,
          permissionRuleSetPermissions.permission,
        ],
      });
  }
}

export async function assignSeedUserRole(
  database: DatabasePg,
  userId: UUIDType,
  tenantId: UUIDType,
  role: UserRole,
) {
  await ensureSeedPermissionData(database, tenantId);

  const [permissionRole] = await database
    .select({
      id: permissionRoles.id,
    })
    .from(permissionRoles)
    .where(and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, role)))
    .limit(1);

  if (!permissionRole) {
    throw new Error(`Missing permission role ${role} for tenant ${tenantId}`);
  }

  await database
    .insert(permissionUserRoles)
    .values({
      userId,
      roleId: permissionRole.id,
      tenantId,
    })
    .onConflictDoNothing({
      target: [permissionUserRoles.userId, permissionUserRoles.roleId],
    });
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

function getRoleDisplayName(role: UserRole) {
  switch (role) {
    case USER_ROLES.ADMIN:
      return "Admin";
    case USER_ROLES.CONTENT_CREATOR:
      return "Content Creator";
    case USER_ROLES.STUDENT:
    default:
      return "Student";
  }
}
