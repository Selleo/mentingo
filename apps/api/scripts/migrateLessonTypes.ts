import dotenv from "dotenv";
import { and, eq, getTableColumns, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { chapters, courses, lessons, resourceEntity, resources } from "src/storage/schema";

import * as schema from "../src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg } from "src/common";

dotenv.config({ path: ".env" });

async function runMigration() {
  const yargs = await import("yargs");
  const { hideBin } = await import("yargs/helpers");
  const argv = await yargs
    .default(hideBin(process.argv))
    .option("url", {
      alias: "u",
      description: "Instance URL",
      type: "string",
      demandOption: true,
    })
    .help().argv;

  const pg = postgres(process.env.DATABASE_URL!, { connect_timeout: 2 });
  const db = drizzle(pg, { schema }) as DatabasePg;

  const existingLessons = await db
    .select({
      ...getTableColumns(lessons),
      baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
      resourceId: resources.id,
    })
    .from(lessons)
    .innerJoin(
      resourceEntity,
      and(
        eq(resourceEntity.entityId, lessons.id),
        eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
      ),
    )
    .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .innerJoin(courses, eq(courses.id, chapters.courseId))
    .where(
      and(
        eq(lessons.type, LESSON_TYPES.CONTENT),
        or(
          eq(sql`(${lessons.description})->>${courses.baseLanguage}`, ""),
          isNull(lessons.description),
        ),
      ),
    );

  await Promise.all(
    existingLessons.map(async (lesson) => {
      const url = `${argv.url}/lessons/resource/${lesson.resourceId}`;
      await db
        .update(lessons)
        .set({ description: buildJsonbField(lesson.baseLanguage, url) })
        .where(eq(lessons.id, lesson.id));
    }),
  );

  console.log(`Successfully migrated ${existingLessons.length} lesson(s) of type CONTENT`);

  await pg.end();
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
