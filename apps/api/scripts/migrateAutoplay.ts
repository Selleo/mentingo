import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { annotateVideoAutoplayInContent } from "src/common/utils/annotateVideoAutoplayInContent";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import * as schema from "src/storage/schema";
import { articles, lessons, news } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { DatabasePg } from "src/common";

dotenv.config({ path: ".env" });

const buildAnnotatedContent = (
  content: Record<string, unknown>,
): Record<string, unknown> | null => {
  let nextContent: Record<string, unknown> | null = null;

  for (const language of Object.keys(content)) {
    const current = content[language] as string | null;
    const annotated = annotateVideoAutoplayInContent(current);

    if (annotated !== current) {
      if (!nextContent) nextContent = { ...content };
      nextContent[language] = annotated;
    }
  }

  return nextContent;
};

async function migrateLessons(db: DatabasePg) {
  const existingContentLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.type, LESSON_TYPES.CONTENT));

  for (const lesson of existingContentLessons) {
    const description = (lesson.description as Record<string, unknown>) ?? {};
    const nextDescription = buildAnnotatedContent(description);

    if (!nextDescription) continue;

    await db
      .update(lessons)
      .set({ description: settingsToJSONBuildObject(nextDescription) })
      .where(eq(lessons.id, lesson.id));
  }
}

async function migrateArticles(db: DatabasePg) {
  const existingArticles = await db.select().from(articles);

  for (const article of existingArticles) {
    const content = (article.content as Record<string, unknown>) ?? {};
    const nextContent = buildAnnotatedContent(content);

    if (!nextContent) continue;

    await db
      .update(articles)
      .set({ content: settingsToJSONBuildObject(nextContent) })
      .where(eq(articles.id, article.id));
  }
}

async function migrateNews(db: DatabasePg) {
  const existingNews = await db.select().from(news);

  for (const newsItem of existingNews) {
    const content = (newsItem.content as Record<string, unknown>) ?? {};
    const nextContent = buildAnnotatedContent(content);

    if (!nextContent) continue;

    await db
      .update(news)
      .set({ content: settingsToJSONBuildObject(nextContent) })
      .where(eq(news.id, newsItem.id));
  }
}

async function runMigration() {
  const pg = postgres(process.env.DATABASE_URL!, { connect_timeout: 2 });
  const db = drizzle(pg, { schema }) as DatabasePg;

  try {
    await migrateLessons(db);
    await migrateArticles(db);
    await migrateNews(db);
  } finally {
    await pg.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
