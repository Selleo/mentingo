import { Inject, Injectable } from "@nestjs/common";
import slugify from "@sindresorhus/slugify";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { difference } from "lodash";

import { DatabasePg } from "src/common";
import { courses, courseSlugs } from "src/storage/schema";

@Injectable()
export class CourseSlugService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async regenerateCoursesSlugs(courseIds: string[]) {
    if (!courseIds.length) return [];

    const result: Array<{ courseId: string; lang: string; slug: string }> = [];
    const coursesWithTitles = await this.db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    return await this.db.transaction(async (trx) => {
      for (const course of coursesWithTitles) {
        if (!course.title || typeof course.title !== "object" || course.title === null) continue;

        for (const [lang, title] of Object.entries(course.title)) {
          if (!title || typeof title !== "string" || title === null) continue;

          const slug = await this.generateUniqueCourseSlug(course.id, title, trx);

          await trx
            .insert(courseSlugs)
            .values({ courseId: course.id, lang, slug })
            .onConflictDoUpdate({
              target: [courseSlugs.courseId, courseSlugs.lang],
              set: {
                slug: sql.raw(`excluded.${courseSlugs.slug.name}`),
              },
            });

          result.push({ courseId: course.id, lang, slug });
        }
      }

      return result;
    });
  }

  async getCoursesSlugs(lang: string, courseIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!courseIds.length) return result;
    const courseSlugsData = await this.db
      .select({ courseId: courseSlugs.courseId, slug: courseSlugs.slug })
      .from(courseSlugs)
      .where(and(inArray(courseSlugs.courseId, courseIds), eq(courseSlugs.lang, lang)));

    for (const { courseId, slug } of courseSlugsData) {
      result.set(courseId, slug);
    }

    const missingIds = difference(courseIds, Array.from(result.keys()));

    const regeneratedSlugs = await this.regenerateCoursesSlugs(missingIds);
    for (const { courseId, lang: slugLang, slug } of regeneratedSlugs) {
      if (slugLang !== lang) continue;
      result.set(courseId, slug);
    }

    const notRegeneratedIds = difference(courseIds, Array.from(result.keys()));
    for (const courseId of notRegeneratedIds) {
      result.set(courseId, courseId);
    }

    return result;
  }

  async getCourseIdBySlug(slug: string): Promise<string> {
    const [courseId] = await this.db
      .select({ courseId: courseSlugs.courseId })
      .from(courseSlugs)
      .where(eq(courseSlugs.slug, slug));
    return courseId?.courseId || slug;
  }

  private async generateUniqueCourseSlug(
    courseId: string,
    title: unknown,
    dbInstance?: DatabasePg,
  ): Promise<string> {
    if (!title || typeof title !== "string") {
      return courseId;
    }

    const db = dbInstance || this.db;
    const baseSlug = slugify(title, { lowercase: true, separator: "-" });

    const [existingBase] = await db
      .select({ courseId: courseSlugs.courseId })
      .from(courseSlugs)
      .where(eq(courseSlugs.slug, baseSlug))
      .limit(1);

    if (!existingBase || existingBase.courseId === courseId) {
      return baseSlug;
    }

    const baseSlugLength = baseSlug.length;
    const matchingSlugs = await db
      .select({
        suffix: sql<string>`SUBSTRING(${courseSlugs.slug} FROM ${baseSlugLength + 2})`.as("suffix"),
      })
      .from(courseSlugs)
      .where(ilike(courseSlugs.slug, `${baseSlug}-%`));

    const numbers = matchingSlugs
      .map(({ suffix }) => {
        const num = parseInt(suffix, 10);
        return Number.isNaN(num) ? null : num;
      })
      .filter((num): num is number => num !== null);

    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNumber = maxNumber + 1;

    return `${baseSlug}-${nextNumber}`;
  }
}
