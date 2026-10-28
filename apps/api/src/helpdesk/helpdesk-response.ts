import { TypeCompiler } from "@sinclair/typebox/compiler";

import {
  helpdeskDomainsResponseSchema,
  helpdeskSearchResponseSchema,
  helpdeskTutorialResponseSchema,
} from "./schemas/helpdesk.schema";

import type {
  HelpdeskDomainsResponse,
  HelpdeskSearchResponse,
  HelpdeskTutorialResponse,
} from "./schemas/helpdesk.schema";

const tutorialValidator = TypeCompiler.Compile(helpdeskTutorialResponseSchema);
const searchValidator = TypeCompiler.Compile(helpdeskSearchResponseSchema);
const domainsValidator = TypeCompiler.Compile(helpdeskDomainsResponseSchema);
const VIDEO_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const videoPath = new RegExp(`^/(${VIDEO_ID})/playlist\\.m3u8$`);
const posterPath = new RegExp(`^/(${VIDEO_ID})/thumbnail\\.jpg$`);
const CDN_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+b-cdn\.net$/;

function invalidResponse(): never {
  throw new Error("Invalid Helpdesk response");
}

function playbackUrl(value: string, path: RegExp): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !CDN_HOST.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !path.test(url.pathname)
  )
    invalidResponse();
  return url;
}

/** Treat generated SDK answers as untrusted JSON, then project only public product guidance. */
export function readHelpdeskTutorial(data: unknown): HelpdeskTutorialResponse {
  if (!tutorialValidator.Check(data)) invalidResponse();
  const video = playbackUrl(data.videoUrl, videoPath);
  const poster = playbackUrl(data.posterUrl, posterPath);
  if (
    video.origin !== poster.origin ||
    video.pathname.split("/")[1] !== poster.pathname.split("/")[1]
  ) {
    invalidResponse();
  }

  const chapterIds = new Set<string>();
  let previousEnd = 0;
  for (const chapter of data.chapters) {
    if (
      chapterIds.has(chapter.id) ||
      !Number.isSafeInteger(chapter.startMs) ||
      !Number.isSafeInteger(chapter.endMs) ||
      chapter.startMs < previousEnd ||
      chapter.endMs <= chapter.startMs ||
      chapter.endMs > data.durationMs
    )
      invalidResponse();
    chapterIds.add(chapter.id);
    previousEnd = chapter.endMs;
  }

  return {
    key: data.key,
    revisionId: data.revisionId,
    domain: data.domain,
    title: data.title,
    description: data.description,
    language: data.language,
    languageFallback: data.languageFallback,
    durationMs: data.durationMs,
    videoUrl: video.href,
    posterUrl: poster.href,
    pageKeys: [...data.pageKeys],
    chapters: data.chapters.map(({ id, title, description, startMs, endMs }) => ({
      id,
      title,
      description,
      startMs,
      endMs,
    })),
  };
}

export function readHelpdeskSearch(data: unknown): HelpdeskSearchResponse {
  if (!searchValidator.Check(data)) invalidResponse();
  return {
    mode: data.mode,
    results: data.results.map((hit) => {
      const tutorial = readHelpdeskTutorial(hit.tutorial);
      const chapter = hit.chapterId
        ? tutorial.chapters.find(({ id }) => id === hit.chapterId)
        : undefined;
      if (
        !Number.isFinite(hit.rankScore) ||
        !Number.isSafeInteger(hit.startMs) ||
        !Number.isSafeInteger(hit.endMs) ||
        hit.endMs <= hit.startMs ||
        hit.endMs > tutorial.durationMs ||
        (hit.chapterId && (!chapter || hit.startMs < chapter.startMs || hit.endMs > chapter.endMs))
      )
        invalidResponse();
      return {
        tutorial,
        ...(hit.chapterId !== undefined ? { chapterId: hit.chapterId } : {}),
        excerpt: hit.excerpt,
        startMs: hit.startMs,
        endMs: hit.endMs,
        rankScore: hit.rankScore,
      };
    }),
  };
}

export function readHelpdeskDomains(data: unknown): HelpdeskDomainsResponse {
  if (!domainsValidator.Check(data)) invalidResponse();
  return [...data];
}
