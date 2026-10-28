import type { HelpdeskSearchHit, HelpdeskTutorial } from "../helpdesk.types";

export const helpdeskTutorialFixture: HelpdeskTutorial = {
  key: "course-authoring.publish-a-course",
  revisionId: "30000000-0000-4000-8000-000000000000",
  domain: "course-authoring",
  title: "Publish a course",
  description: "Review your course and make it available to learners.",
  language: "en",
  languageFallback: false,
  durationMs: 60_000,
  videoUrl: "https://vz-help.b-cdn.net/10000000-0000-4000-8000-000000000000/playlist.m3u8",
  posterUrl: "https://vz-help.b-cdn.net/10000000-0000-4000-8000-000000000000/thumbnail.jpg",
  pageKeys: ["admin.course.curriculum"],
  chapters: [
    {
      id: "overview",
      title: "Prepare the course",
      description: "Start with the curriculum.",
      startMs: 0,
      endMs: 12_345,
    },
    {
      id: "review",
      title: "Review publication",
      description: "Check the course before publishing.",
      startMs: 12_345,
      endMs: 60_000,
    },
  ],
};
export const helpdeskHitFixture: HelpdeskSearchHit = {
  tutorial: helpdeskTutorialFixture,
  chapterId: "review",
  excerpt: "Check the course before publishing.",
  startMs: 12_345,
  endMs: 60_000,
  rankScore: 0.03,
};
