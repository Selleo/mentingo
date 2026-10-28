import type { HelpdeskTutorial } from "./helpdesk.types";

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
