import { GLOBAL_SEARCH_RESULT_TYPES } from "@repo/shared";

import {
  buildSearchResultTree,
  GLOBAL_SEARCH_LESSONS_PER_COURSE,
  limitLessonsPerCourse,
} from "./global-search.result-tree";

import type { SearchResultTreeInput } from "./global-search.types";

const empty: SearchResultTreeInput = {
  courseLists: [],
  lessons: [],
  learningPaths: [],
  news: [],
  articles: [],
  qa: [],
};

const lesson = (id: string, courseId: string, relevanceScore?: number) => ({
  id,
  title: `Lesson ${id}`,
  courseId,
  courseTitle: `Course ${courseId}`,
  chapterTitle: "Chapter 1",
  courseThumbnailUrl: "https://cdn.test/thumb.png",
  courseCategory: "Safety",
  ...(relevanceScore === undefined ? {} : { relevanceScore }),
});

describe("buildSearchResultTree", () => {
  it("nests a lesson under its course even when the course did not match", () => {
    const [node] = buildSearchResultTree({
      ...empty,
      lessons: [{ ...lesson("l1", "c1", 0.4), matchedPassage: "evidence" }],
    });

    expect(node).toEqual({
      type: GLOBAL_SEARCH_RESULT_TYPES.COURSE,
      id: "c1",
      title: "Course c1",
      category: "Safety",
      thumbnailUrl: "https://cdn.test/thumb.png",
      matched: false,
      relevanceScore: 0.4,
      hiddenLessonCount: 0,
      lessons: [
        {
          type: GLOBAL_SEARCH_RESULT_TYPES.LESSON,
          id: "l1",
          title: "Lesson l1",
          courseId: "c1",
          chapterTitle: "Chapter 1",
          relevanceScore: 0.4,
          matchedPassage: "evidence",
        },
      ],
    });
  });

  it("merges lessons into a matched course, keeps its own evidence and lifts its score", () => {
    const [node] = buildSearchResultTree({
      ...empty,
      courseLists: [
        [{ id: "c1", title: "Matched", relevanceScore: 0.2, matchedPassage: "course evidence" }],
      ],
      lessons: [lesson("l1", "c1", 0.9)],
    });

    expect(node).toMatchObject({
      id: "c1",
      title: "Matched",
      matched: true,
      relevanceScore: 0.9,
      matchedPassage: "course evidence",
      lessons: [{ id: "l1" }],
    });
  });

  it("deduplicates courses across lists, preferring the first list", () => {
    const nodes = buildSearchResultTree({
      ...empty,
      courseLists: [
        [{ id: "c1", title: "Enrolled", completedChapterCount: 2, courseChapterCount: 4 }],
        [{ id: "c1", title: "Catalog" }],
      ],
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ title: "Enrolled", completedChapterCount: 2 });
  });

  it("orders every lesson by score, and caps groups only when asked", () => {
    const scores = [0.1, 0.5, 0.3, 0.9, 0.2];
    const tree = buildSearchResultTree({
      ...empty,
      lessons: scores.map((score, index) => lesson(`l${index}`, "c1", score)),
      articles: [{ id: "a1", title: "Article" }],
    });
    const [node] = tree;

    if (node.type !== GLOBAL_SEARCH_RESULT_TYPES.COURSE) throw new Error("expected a course");
    expect(node.lessons.map((child) => child.id)).toEqual(["l3", "l1", "l2", "l4", "l0"]);
    expect(node.hiddenLessonCount).toBe(0);

    const [limited, article] = limitLessonsPerCourse(tree);
    if (limited.type !== GLOBAL_SEARCH_RESULT_TYPES.COURSE) throw new Error("expected a course");
    expect(limited.lessons.map((child) => child.id)).toEqual(["l3", "l1", "l2"]);
    expect(limited.lessons).toHaveLength(GLOBAL_SEARCH_LESSONS_PER_COURSE);
    expect(limited.hiddenLessonCount).toBe(2);
    expect(limited.relevanceScore).toBe(0.9);
    expect(article).toBe(tree[1]);
  });

  it("ranks groups and flat content in one relevance order", () => {
    const nodes = buildSearchResultTree({
      ...empty,
      courseLists: [[{ id: "c1", title: "Weak course", relevanceScore: 0.1 }]],
      lessons: [lesson("l1", "c2", 0.6)],
      articles: [{ id: "a1", title: "Best article", relevanceScore: 0.8 }],
      news: [{ id: "n1", title: "Unscored news" }],
      learningPaths: [
        {
          id: "p1",
          title: "Path",
          relevanceScore: 0.3,
          thumbnailReference: null,
          courses: [{ id: "c1" }, { id: "c2" }],
        },
      ],
    });

    expect(nodes.map((node) => node.id)).toEqual(["a1", "c2", "p1", "c1", "n1"]);
    expect(nodes.find((node) => node.id === "p1")).toMatchObject({
      type: GLOBAL_SEARCH_RESULT_TYPES.LEARNING_PATH,
      courseCount: 2,
    });
  });
});
