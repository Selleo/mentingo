/* eslint-disable no-console */

import { ALLOWED_PRESENTATION_FILE_TYPES, ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import dotenv from "dotenv";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { match } from "ts-pattern";

import { buildSqlInClause, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { chapters, courses, lessons, resourceEntity, resources } from "src/storage/schema";

import * as schema from "../src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg } from "src/common";

dotenv.config({ path: ".env" });

const INTERNAL_RESOURCE_BLOCK = {
  presentation: (src: string) =>
    `<div data-node-type="presentation" data-source-type="internal" data-provider="self" data-src="${src}"></div>`,
  video: (src: string) =>
    `<div data-node-type="video" data-source-type="internal" data-provider="self" data-src="${src}"></div>`,
  download: (src: string, name: string) =>
    `<div data-node-type="downloadable-file" data-src="${src}" data-name="${name}"></div>`,
} as const;

const EXTERNAL_RESOURCE_BLOCK = {
  googleSlides: (src: string) =>
    `<div data-node-type="presentation" data-source-type="external" data-provider="google" data-src="${src}"></div>`,
  canva: (src: string) =>
    `<div data-node-type="presentation" data-source-type="external" data-provider="canva" data-src="${src}"></div>`,
  youtube: (src: string) =>
    `<div data-node-type="video" data-source-type="external" data-provider="youtube" data-src="${src}"></div>`,
  vimeo: (src: string) =>
    `<div data-node-type="video" data-source-type="external" data-provider="vimeo" data-src="${src}"></div>`,
} as const;

const MESSAGE_BLOCK = {
  unsupportedExternalPresentation:
    "<p>External presentation URL is not supported. Please upload the file and replace this block.</p>",
  unsupportedExternalVideo:
    "<p>External video URL is not supported. Please upload the file and replace this block.</p>",
} as const;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "ogg", "avi", "wmv", "quicktime"] as const;
const ALLOWED_PRESENTATION_EXTENSIONS = ["ppt", "pptx", "odp"] as const;

const PRESENTATION_REFERENCE_REGEX = /docs\.google\.com\/.*presentation|canva\.com\/.*design/i;

const RESOURCE_REFERENCE_WHERE_REGEX =
  "(youtube\\.com|youtu\\.be|vimeo\\.com|docs\\.google\\.com/.*/presentation|canva\\.com/.*/design)";

const normalizeString = (value: string | null | undefined) =>
  typeof value === "string" ? value.toLowerCase() : "";

const isExternalUrl = (reference: string | null | undefined) =>
  typeof reference === "string" && /^https?:\/\//i.test(reference);

const isPresentationReference = (reference: string | null | undefined) =>
  typeof reference === "string" &&
  (/(\.pptx|\.ppt|\.odp)(\?|#|$)/i.test(reference) || PRESENTATION_REFERENCE_REGEX.test(reference));

const getOriginalFilename = (metadata: unknown): string | null => {
  const record = metadata as Record<string, unknown> | null;
  return typeof record?.originalFilename === "string" ? record.originalFilename : null;
};

const allowedVideoContentTypes = [
  ...ALLOWED_VIDEO_FILE_TYPES,
  ...ALLOWED_VIDEO_FILE_TYPES.map((type) => type.split("/")[1]).filter(Boolean),
  ...ALLOWED_VIDEO_EXTENSIONS,
].map((t) => t.toLowerCase());

const allowedPresentationContentTypes = [
  ...ALLOWED_PRESENTATION_FILE_TYPES,
  ...ALLOWED_PRESENTATION_EXTENSIONS,
].map((t) => t.toLowerCase());

type ResourceKind = "video" | "presentation" | "other";
type Provider = "self" | "youtube" | "vimeo" | "google" | "canva" | "unsupported-external";

type ResourceClassification = {
  kind: ResourceKind;
  isExternal: boolean;
  provider: Provider;
};

function classifyResource(input: {
  reference: string | null;
  contentType: string | null;
}): ResourceClassification {
  const reference = input.reference ?? "";
  const contentType = normalizeString(input.contentType);
  const external = isExternalUrl(input.reference);

  const isVideo =
    contentType.startsWith("video/") || allowedVideoContentTypes.includes(contentType);

  const isPresentation =
    allowedPresentationContentTypes.includes(contentType) ||
    isPresentationReference(input.reference);

  if (isPresentation) {
    if (!external) return { kind: "presentation", isExternal: false, provider: "self" };
    if (/docs\.google\.com\/.*presentation/i.test(reference))
      return { kind: "presentation", isExternal: true, provider: "google" };
    if (/canva\.com\/.*design/i.test(reference))
      return { kind: "presentation", isExternal: true, provider: "canva" };
    return { kind: "presentation", isExternal: true, provider: "unsupported-external" };
  }

  if (isVideo) {
    if (!external) return { kind: "video", isExternal: false, provider: "self" };
    if (/youtube\.com|youtu\.be/i.test(reference))
      return { kind: "video", isExternal: true, provider: "youtube" };
    if (/vimeo\.com/i.test(reference))
      return { kind: "video", isExternal: true, provider: "vimeo" };
    return { kind: "video", isExternal: true, provider: "unsupported-external" };
  }

  return {
    kind: "other",
    isExternal: external,
    provider: external ? "unsupported-external" : "self",
  };
}

function buildEmbedHtml(params: {
  classification: ResourceClassification;
  reference: string | null;
  resourceUrl: string;
  fileName: string | null;
}): string {
  const { classification, reference, resourceUrl, fileName } = params;

  return match(classification)
    .with({ kind: "presentation", isExternal: false }, () =>
      INTERNAL_RESOURCE_BLOCK.presentation(resourceUrl),
    )
    .with({ kind: "presentation", isExternal: true, provider: "google" }, () =>
      EXTERNAL_RESOURCE_BLOCK.googleSlides(reference ?? ""),
    )
    .with({ kind: "presentation", isExternal: true, provider: "canva" }, () =>
      EXTERNAL_RESOURCE_BLOCK.canva(reference ?? ""),
    )
    .with(
      { kind: "presentation", isExternal: true },
      () => MESSAGE_BLOCK.unsupportedExternalPresentation,
    )
    .with({ kind: "video", isExternal: false }, () => INTERNAL_RESOURCE_BLOCK.video(resourceUrl))
    .with({ kind: "video", isExternal: true, provider: "youtube" }, () =>
      EXTERNAL_RESOURCE_BLOCK.youtube(reference ?? ""),
    )
    .with({ kind: "video", isExternal: true, provider: "vimeo" }, () =>
      EXTERNAL_RESOURCE_BLOCK.vimeo(reference ?? ""),
    )
    .with({ kind: "video", isExternal: true }, () => MESSAGE_BLOCK.unsupportedExternalVideo)
    .otherwise(() => INTERNAL_RESOURCE_BLOCK.download(resourceUrl, fileName ?? ""));
}

function descriptionAlreadyContainsResource(params: {
  description: string;
  resourceUrl: string;
  resourceId: string;
  reference: string | null;
}): boolean {
  const { description, resourceUrl, resourceId, reference } = params;
  return (
    description.includes(resourceUrl) ||
    description.includes(resourceId) ||
    (!!reference && description.includes(reference))
  );
}

function mergeDescription(existingDescription: string, embedHtml: string): string {
  return existingDescription
    ? `<p>${existingDescription}</p><p></p>${embedHtml}`
    : `<p></p>${embedHtml}`;
}

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
      availableLanguages: sql<SupportedLanguages[]>`${courses.availableLocales}`,
      resourceId: resources.id,
      resourceReference: resources.reference,
      resourceContentType: resources.contentType,
      resourceMetadata: resources.metadata,
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
        sql`(
          lower(${resources.contentType}) in ${buildSqlInClause(allowedVideoContentTypes)}
          OR lower(${resources.contentType}) in ${buildSqlInClause(allowedPresentationContentTypes)}
          OR ${resources.contentType} = 'embed'
          OR ${resources.reference} ~* ${RESOURCE_REFERENCE_WHERE_REGEX}
        )`,
      ),
    );

  await Promise.all(
    existingLessons.map(async (lesson) => {
      const {
        resourceId,
        resourceReference: reference,
        resourceContentType: contentType,
        resourceMetadata: metadata,
      } = lesson;

      const resourceUrl = `${argv.url}/api/lesson/lesson-resource/${resourceId}`;
      const fileName = getOriginalFilename(metadata);

      const classification = classifyResource({ reference, contentType });

      const embedHtml = buildEmbedHtml({
        classification,
        reference,
        resourceUrl,
        fileName,
      });

      const description = (lesson.description ?? {}) as Partial<Record<SupportedLanguages, string>>;

      for (const lang of lesson.availableLanguages) {
        const existingDescription = description[lang] || "";

        if (
          descriptionAlreadyContainsResource({
            description: existingDescription,
            resourceUrl,
            resourceId,
            reference,
          })
        ) {
          console.log(
            `Skipping lesson for language ${lang} (already contains resource):`,
            lesson.id,
          );
          continue;
        }

        await db
          .update(lessons)
          .set({
            description: setJsonbField(
              lessons.description,
              lang,
              mergeDescription(existingDescription, embedHtml),
              true,
            ),
          })
          .where(eq(lessons.id, lesson.id));
      }
    }),
  );

  console.log(`Successfully migrated ${existingLessons.length} lesson(s) of type CONTENT`);
  await pg.end();
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
