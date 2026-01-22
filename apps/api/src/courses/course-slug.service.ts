import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import slugify from "slugify";
import { validate as uuidValidate } from "uuid";

import { DatabasePg } from "src/common";
import { courses, courseSlugs } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";

export type CourseSlugResult =
  | { type: "found"; courseId: string; slug: string }
  | { type: "redirect"; courseId: string; slug: string }
  | { type: "notFound" }
  | { type: "uuid"; courseId: string; slug: string };

const SLUG_MATCH = /^([a-z0-9]{5})-([^ ]+)$/;

@Injectable()
export class CourseSlugService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  private async generateUniqueShortId(): Promise<string | null> {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    const nanoid = customAlphabet(alphabet, 5);

    let attempts = 10;
    while (attempts > 0) {
      const shortId = nanoid();
      const [existing] = await this.db
        .select({ shortId: courses.shortId })
        .from(courses)
        .where(eq(courses.shortId, shortId))
        .limit(1);
      if (!existing) return shortId;
      attempts--;
    }

    return null;
  }

  async ensureCourseShortId(courseId: string): Promise<string | null> {
    const [course] = await this.db
      .select({ id: courses.id, shortId: courses.shortId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return null;
    if (course.shortId) return course.shortId;

    const newShortId = await this.generateUniqueShortId();
    if (!newShortId) return null;

    await this.db.update(courses).set({ shortId: newShortId }).where(eq(courses.id, courseId));

    return newShortId;
  }

  async regenerateCoursesSlugs(courseIds: string[]) {
    if (!courseIds.length) return [];

    const result: Array<{ courseId: string; lang: string; slug: string; courseShortId: string }> =
      [];
    const langsToDelete: Array<{ courseShortId: string; lang: string }> = [];

    const coursesWithTitles = await this.db
      .select({ id: courses.id, courseShortId: courses.shortId, title: courses.title })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    for (const course of coursesWithTitles) {
      let shortId = course.courseShortId;
      if (!shortId) {
        shortId = await this.ensureCourseShortId(course.id);
      }
      if (!shortId) continue;

      const titleObj = course.title as Record<string, string> | null;
      if (!titleObj || typeof titleObj !== "object") continue;

      for (const [lang, title] of Object.entries(titleObj)) {
        if (!title || typeof title !== "string") {
          langsToDelete.push({ courseShortId: shortId, lang });
          continue;
        }

        const slug = this.createSlugFromText(title);

        result.push({
          courseId: course.id,
          lang,
          slug,
          courseShortId: shortId,
        });
      }
    }

    for (const { courseShortId, lang } of langsToDelete) {
      await this.db
        .delete(courseSlugs)
        .where(and(eq(courseSlugs.courseShortId, courseShortId), eq(courseSlugs.lang, lang)));
    }

    if (result.length) {
      await this.db
        .insert(courseSlugs)
        .values(result)
        .onConflictDoUpdate({
          target: [courseSlugs.courseShortId, courseSlugs.lang],
          set: {
            slug: sql`EXCLUDED.slug`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
    }

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

    const existingSlugs = await this.db
      .select({
        courseId: courses.id,
        courseShortId: courses.shortId,
        slug: courseSlugs.slug,
      })
      .from(courses)
      .leftJoin(
        courseSlugs,
        and(eq(courseSlugs.courseShortId, courses.shortId), eq(courseSlugs.lang, resolvedLang)),
      )
      .where(inArray(courses.id, courseIds));

    const idsWithoutSlug: string[] = [];

    for (const entry of existingSlugs) {
      if (entry.slug && entry.courseShortId) {
        result.set(entry.courseId, this.generateSlug(entry.courseShortId, entry.slug));
      } else {
        idsWithoutSlug.push(entry.courseId);
      }
    }

    if (idsWithoutSlug.length) {
      const regeneratedSlugs = await this.regenerateCoursesSlugs(idsWithoutSlug);
      for (const { courseId, lang: slugLang, slug } of regeneratedSlugs) {
        if (slugLang !== resolvedLang) continue;
        result.set(courseId, slug);
      }
    }

    for (const courseId of courseIds) {
      if (!result.has(courseId)) {
        result.set(courseId, courseId);
      }
    }

    return result;
  }

  async getCourseIdBySlug(
    idOrSlug: string,
    language: SupportedLanguages,
  ): Promise<CourseSlugResult> {
    if (uuidValidate(idOrSlug)) {
      const [course] = await this.db
        .select({
          id: courses.id,
          shortId: courses.shortId,
          baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
          availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
        })
        .from(courses)
        .where(eq(courses.id, idOrSlug))
        .limit(1);

      if (!course) {
        return { type: "notFound" };
      }

      const currentSlug = await this.resolveSlugWithFallback({
        courseId: course.id,
        courseShortId: course.shortId,
        requestedLanguage: language,
        availableLocales: course.availableLocales,
        baseLanguage: course.baseLanguage,
      });

      return { type: "uuid", courseId: idOrSlug, slug: currentSlug };
    }

    const slugParts = this.parseSlug(idOrSlug);

    if (!slugParts) {
      return { type: "notFound" };
    }

    const { shortId, baseSlug } = slugParts;

    const [course] = await this.db
      .select({
        id: courses.id,
        shortId: courses.shortId,
        availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
      })
      .from(courses)
      .where(eq(courses.shortId, shortId))
      .limit(1);

    if (!course) {
      return { type: "notFound" };
    }

    const currentSlug = await this.resolveSlugWithFallback({
      courseId: course.id,
      courseShortId: course.shortId,
      requestedLanguage: language,
      availableLocales: course.availableLocales,
      baseLanguage: course.baseLanguage,
    });

    const inputSlug = this.generateSlug(shortId, baseSlug);

    return inputSlug === currentSlug
      ? { type: "found", courseId: course.id, slug: currentSlug }
      : { type: "redirect", courseId: course.id, slug: currentSlug };
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

  private resolveLanguage(
    requestedLanguage: SupportedLanguages,
    availableLocales?: SupportedLanguages[] | null,
    baseLanguage?: SupportedLanguages | null,
  ) {
    if (availableLocales?.includes(requestedLanguage)) return requestedLanguage;

    if (baseLanguage) return baseLanguage;

    return SUPPORTED_LANGUAGES.EN;
  }

  private async resolveSlugWithFallback(options: {
    courseId: string;
    courseShortId: string | null;
    requestedLanguage: SupportedLanguages;
    availableLocales?: SupportedLanguages[];
    baseLanguage: SupportedLanguages;
  }) {
    const { courseId, courseShortId, requestedLanguage, availableLocales, baseLanguage } = options;

    const resolvedShortId = courseShortId ?? (await this.ensureCourseShortId(courseId));
    if (!resolvedShortId) return courseId;

    const languageToUse = this.resolveLanguage(requestedLanguage, availableLocales, baseLanguage);

    const [currentLangSlug] = await this.db
      .select({ slug: courseSlugs.slug })
      .from(courseSlugs)
      .where(
        and(eq(courseSlugs.courseShortId, resolvedShortId), eq(courseSlugs.lang, languageToUse)),
      )
      .limit(1);

    if (currentLangSlug?.slug) return this.generateSlug(resolvedShortId, currentLangSlug.slug);

    const regenerated = await this.regenerateCoursesSlugs([courseId]);
    const regeneratedForLang = regenerated.find((entry) => entry.lang === languageToUse);

    if (regeneratedForLang?.slug) return regeneratedForLang.slug;

    const fallbackSlugs = await this.db
      .select({ slug: courseSlugs.slug, lang: courseSlugs.lang })
      .from(courseSlugs)
      .where(eq(courseSlugs.courseShortId, resolvedShortId));

    const preferredBaseLang = baseLanguage || SUPPORTED_LANGUAGES.EN;

    const baseLangSlug = fallbackSlugs.find((entry) => entry.lang === preferredBaseLang)?.slug;
    if (baseLangSlug) return this.generateSlug(resolvedShortId, baseLangSlug);

    const anySlug = fallbackSlugs[0]?.slug;
    if (anySlug) return this.generateSlug(resolvedShortId, anySlug);

    return courseId;
  }
}
