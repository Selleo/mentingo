import type { HelpdeskSearchHit, HelpdeskTutorial } from "./helpdesk.types";

const DEMO_TUTORIAL_KEY_PREFIX = "demo.";

/** Present demo status separately from the task title; avoid punctuation-heavy labels. */
export function helpdeskTutorialLabel(tutorial: HelpdeskTutorial) {
  const isDemo = tutorial.key.startsWith(DEMO_TUTORIAL_KEY_PREFIX);
  const title = isDemo
    ? tutorial.title.replace(/^demo\b\s*[:\u2014\u2013-]?\s*/i, "")
    : tutorial.title;
  return { isDemo, title: title.replace(/\s*\u2014\s*/g, ": ") };
}

export type HelpdeskResultGroup = {
  tutorial: HelpdeskTutorial;
  startMs: number;
  chapters: { chapter: HelpdeskTutorial["chapters"][number]; startMs: number }[];
};

/** Preserve ranked video/chapter order while merging repeated hits for the same revision. */
export function groupHelpdeskResults(hits: HelpdeskSearchHit[]): HelpdeskResultGroup[] {
  const groups = new Map<string, HelpdeskResultGroup>();
  const seenChapters = new Set<string>();
  for (const hit of hits) {
    const { tutorial } = hit;
    let group = groups.get(tutorial.revisionId);
    if (!group) {
      group = { tutorial, startMs: hit.startMs, chapters: [] };
      groups.set(tutorial.revisionId, group);
    }
    const chapter = tutorial.chapters.find((item) => item.id === hit.chapterId);
    if (!chapter) continue;
    const chapterKey = `${tutorial.revisionId}:${chapter.id}`;
    if (seenChapters.has(chapterKey)) continue;
    seenChapters.add(chapterKey);
    group.chapters.push({ chapter, startMs: hit.startMs });
    if (group.chapters.length === 1) group.startMs = hit.startMs;
  }
  return [...groups.values()];
}

export const HELPDESK_DOMAIN_LABELS = {
  "course-authoring": "helpdesk.domains.authoring",
  "development-paths": "helpdesk.domains.paths",
  "course-learning": "helpdesk.domains.learning",
} as const;

export const formatHelpdeskTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Send a symbolic product area, never a route containing tenant/resource identifiers. */
export function getHelpdeskPageKey(pathname: string): string | undefined {
  if (/^\/(?:admin\/)?development-paths(?:\/|$)/.test(pathname)) return "development-paths";
  if (/^\/admin\/(?:beta-courses|courses)(?:\/|$)/.test(pathname)) return "admin.course.curriculum";
  if (/^\/course(?:\/|$)/.test(pathname) || pathname === "/courses") return "student.course";
  return undefined;
}

export function helpdeskTutorialPath(key: string, chapterId?: string) {
  const path = `/helpdesk/tutorials/${encodeURIComponent(key)}`;
  return chapterId ? `${path}?chapter=${encodeURIComponent(chapterId)}` : path;
}

export function selectedHelpdeskChapter(tutorial: HelpdeskTutorial, chapterId: string | null) {
  return tutorial.chapters.find((chapter) => chapter.id === chapterId);
}
