import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { difference } from "lodash";
import slugify from "slugify";
import { validate as uuidValidate } from "uuid";

import { DatabasePg } from "src/common";
import { courses, courseSlugs } from "src/storage/schema";

export type CourseSlugResult =
  | { type: "found"; courseId: string; slug: string }
  | { type: "redirect"; courseId: string; slug: string }
  | { type: "notFound" }
  | { type: "uuid"; courseId: string; slug: string };

const SLUG_MATCH = /^([a-z0-9]{5})-([^ ]+)$/;

@Injectable()
export class CourseSlugService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async regenerateCoursesSlugs(courseIds: string[]) {
    if (!courseIds.length) return [];

    const result: Array<{ courseId: string; lang: string; slug: string; courseShortId: string }> =
      [];
    const coursesWithTitles = await this.db
      .select({ id: courses.id, courseShortId: courses.shortId, title: courses.title })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    for (const course of coursesWithTitles) {
      if (!course.title || typeof course.title !== "object" || course.title === null) continue;

      for (const [lang, title] of Object.entries(course.title)) {
        if (!title || typeof title !== "string" || title === null) continue;

        const slug = this.createSlugFromText(title);

        result.push({
          courseId: course.id,
          lang,
          slug,
          courseShortId: course.courseShortId,
        });
      }
    }

    await this.db
      .insert(courseSlugs)
      .values(result)
      .onConflictDoUpdate({
        target: [courseSlugs.courseShortId, courseSlugs.lang, courseSlugs.slug],
        set: {
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    return result.map((entry) => ({
      ...entry,
      slug: this.generateSlug(entry.courseShortId, entry.slug),
    }));
  }

  async getCoursesSlugs(
    lang: string | undefined,
    courseIds: string[],
  ): Promise<Map<string, string>> {
    const resolvedLang = lang || SUPPORTED_LANGUAGES.EN;
    const result = new Map<string, string>();
    if (!courseIds.length) return result;

    const latestSlugSubquery = this.db
      .select({
        courseShortId: courseSlugs.courseShortId,
        maxUpdatedAt: max(courseSlugs.updatedAt).as("maxUpdatedAt"),
      })
      .from(courseSlugs)
      .where(eq(courseSlugs.lang, resolvedLang))
      .groupBy(courseSlugs.courseShortId)
      .as("latest_slug");

    const latestSlugs = await this.db
      .select({
        courseId: courses.id,
        courseShortId: courses.shortId,
        slug: courseSlugs.slug,
        createdAt: courseSlugs.createdAt,
      })
      .from(courses)
      .leftJoin(latestSlugSubquery, eq(latestSlugSubquery.courseShortId, courses.shortId))
      .leftJoin(
        courseSlugs,
        and(
          eq(courseSlugs.courseShortId, latestSlugSubquery.courseShortId),
          eq(courseSlugs.updatedAt, latestSlugSubquery.maxUpdatedAt),
          eq(courseSlugs.lang, resolvedLang),
        ),
      )
      .where(inArray(courses.id, courseIds));

    for (const slug of latestSlugs) {
      if (!slug.slug) continue;
      result.set(slug.courseId, this.generateSlug(slug.courseShortId, slug.slug));
    }

    const idsToRegenerate = difference(
      courseIds,
      latestSlugs.filter((x) => !!x.slug).map((s) => s.courseId),
    );

    const regeneratedSlugs = await this.regenerateCoursesSlugs(idsToRegenerate);
    for (const { courseId, lang: slugLang, slug } of regeneratedSlugs) {
      if (slugLang !== resolvedLang) continue;
      result.set(courseId, slug);
    }

    return result;
  }

  async getCourseIdBySlug(idOrSlug: string, language: string): Promise<CourseSlugResult> {
    if (uuidValidate(idOrSlug)) {
      const slugs = await this.getCoursesSlugs(language, [idOrSlug]);

      if (!slugs.size) {
        return { type: "notFound" };
      }

      const latestSlug = slugs.get(idOrSlug)!;

      return { type: "uuid", courseId: idOrSlug, slug: latestSlug };
    }

    const slugParts = this.parseSlug(idOrSlug);

    if (!slugParts) {
      return { type: "notFound" };
    }

    const { shortId, baseSlug } = slugParts;

    const [requestedSlug] = await this.db
      .select({ slug: courseSlugs.slug, courseId: courses.id })
      .from(courseSlugs)
      .leftJoin(courses, eq(courses.shortId, courseSlugs.courseShortId))
      .where(
        and(
          eq(courseSlugs.slug, baseSlug),
          eq(courseSlugs.lang, language),
          eq(courses.shortId, shortId),
        ),
      )
      .limit(1);

    if (!requestedSlug || !requestedSlug.courseId) {
      return { type: "notFound" };
    }

    const [newestSlug] = await this.db
      .select({ slug: courseSlugs.slug, courseId: courses.id })
      .from(courseSlugs)
      .leftJoin(courses, eq(courses.shortId, courseSlugs.courseShortId))
      .where(and(eq(courseSlugs.courseShortId, shortId), eq(courseSlugs.lang, language)))
      .orderBy(desc(courseSlugs.updatedAt))
      .limit(1);

    return newestSlug.slug === baseSlug
      ? {
          type: "found",
          courseId: requestedSlug.courseId,
          slug: this.generateSlug(shortId, requestedSlug.slug),
        }
      : {
          type: "redirect",
          courseId: requestedSlug.courseId,
          slug: this.generateSlug(shortId, newestSlug.slug),
        };
  }

  private createSlugFromText(text: string): string {
    return slugify(text, {
      remove: /[*+~.()'"!:@_\[\]{}|#%^&><?`]/g,
      lower: true,
      replacement: "-",
    });
  }

  private parseSlug(slug?: string | null) {
    if (!slug || typeof slug !== "string") return null;
    const match = slug.match(SLUG_MATCH);
    if (!match) return null;
    return { shortId: match[1], baseSlug: match[2] };
  }

  private generateSlug(shortId: string, baseSlug: string) {
    return `${shortId}-${baseSlug}`;
  }
}
