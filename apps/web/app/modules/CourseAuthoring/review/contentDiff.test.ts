import { describe, expect, it } from "vitest";

import {
  applyBlockReplacements,
  diffContentBlocks,
  diffWords,
  findContentBlock,
} from "./contentDiff";
import { currentQuestion, diffQuestions, proposedQuestion } from "./quizDiff";

import type { Question } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

describe("diffWords", () => {
  it("marks only the words that changed", () => {
    expect(diffWords("Learn the basics fast", "Learn the platform basics")).toEqual([
      { type: "same", text: "Learn the " },
      { type: "added", text: "platform " },
      { type: "same", text: "basics " },
      { type: "removed", text: "fast" },
    ]);
  });

  it("returns nothing for two empty texts", () => {
    expect(diffWords("", "")).toEqual([]);
  });
});

describe("diffContentBlocks", () => {
  it("ignores shifted indices and removed editor metadata when only an image is inserted", () => {
    const before =
      '<h2 data-authoring-block-id="old-heading" data-block-index="0">Why time belongs in a graph model</h2>' +
      '<p data-authoring-block-id="old-text" data-block-index="1">A static graph records connections.</p>' +
      '<p data-authoring-block-id="old-context" data-block-index="2">Time complements structure.</p>';
    const after =
      "<h2>Why time belongs in a graph model</h2>" +
      '<img data-authoring-asset-id="visual">' +
      '<p data-block-index="2" data-authoring-block-id="new-text">A static graph records connections.</p>' +
      "<p>Time complements structure.</p>";
    expect(diffContentBlocks(before, after).map((entry) => entry.status)).toEqual([
      "unchanged",
      "added",
      "unchanged",
      "unchanged",
    ]);
  });

  it("ignores attribute order and nested editor metadata but detects changed links", () => {
    const before =
      '<p data-block-index="0"><a href="/guide" title="Guide" data-authoring-block-id="link">Read the guide.</a></p>';
    const reordered = '<p><a title="Guide" href="/guide">Read the guide.</a></p>';
    expect(diffContentBlocks(before, reordered)[0].status).toBe("unchanged");
    expect(diffContentBlocks(before, reordered.replace("/guide", "/other"))[0].status).toBe(
      "modified",
    );
  });

  it("marks only an inserted image as added when unchanged blocks receive new IDs", () => {
    const before =
      '<h2 data-authoring-block-id="old-heading">Architecture</h2><p data-authoring-block-id="old-text">Compare the evidence.</p>';
    const after =
      '<h2 data-authoring-block-id="new-heading">Architecture</h2><img data-authoring-block-id="new-image" data-authoring-asset-id="visual"><p data-authoring-block-id="new-text">Compare the evidence.</p>';
    expect(diffContentBlocks(before, after).map((entry) => entry.status)).toEqual([
      "unchanged",
      "added",
      "unchanged",
    ]);
  });

  it("still detects text and formatting edits when IDs are regenerated", () => {
    expect(
      diffContentBlocks(
        '<p data-authoring-block-id="old">Compare the evidence.</p>',
        '<p data-authoring-block-id="new">Compare the stronger evidence.</p>',
      ).map((entry) => entry.status),
    ).toEqual(["modified"]);
    expect(
      diffContentBlocks(
        '<p data-authoring-block-id="old">Compare the evidence.</p>',
        '<p data-authoring-block-id="new"><strong>Compare</strong> the evidence.</p>',
      ).map((entry) => entry.status),
    ).toEqual(["modified"]);
  });

  it("pairs blocks by authoring id and classifies them", () => {
    const before =
      '<p data-authoring-block-id="a">Welcome to the course</p><p data-authoring-block-id="b">Old tips</p><h2 data-authoring-block-id="c">Summary</h2>';
    const after =
      '<p data-authoring-block-id="a">Welcome to the Mentingo course</p><h2 data-authoring-block-id="c">Summary</h2><p>Next steps</p>';

    expect(diffContentBlocks(before, after).map((entry) => entry.status)).toEqual([
      "modified",
      "removed",
      "unchanged",
      "added",
    ]);
  });

  it("treats a rewritten block without ids as a modification, not remove plus add", () => {
    const entries = diffContentBlocks(
      "<p>Mentingo helps teams learn together</p>",
      "<p>Mentingo helps whole teams learn together quickly</p>",
    );
    expect(entries.map((entry) => entry.status)).toEqual(["modified"]);
  });

  it("finds a block by id", () => {
    expect(findContentBlock('<p data-authoring-block-id="x">Hi</p>', "x")?.text).toBe("Hi");
    expect(findContentBlock("<p>Hi</p>", "x")).toBeNull();
  });
});

describe("diffQuestions", () => {
  const live: Question = {
    id: "q1",
    sortableId: "q1",
    type: "single_choice" as Question["type"],
    displayOrder: 0,
    title: "Where do you start?",
    options: [
      { id: "o1", sortableId: "o1", optionText: "Dashboard", isCorrect: true, displayOrder: 0 },
      { id: "o2", sortableId: "o2", optionText: "Settings", isCorrect: false, displayOrder: 1 },
    ],
  };

  it("detects an answer-key change on the same question", () => {
    const proposed = proposedQuestion(
      {
        id: "q1",
        questionType: "single_choice",
        title: "Where do you start?",
        options: [
          { id: "o1", label: "Dashboard", isCorrect: false },
          { id: "o2", label: "Settings", isCorrect: true },
        ],
      },
      0,
    );
    const entries = diffQuestions([currentQuestion(live, 0)], proposed ? [proposed] : []);
    expect(entries.map((entry) => entry.status)).toEqual(["modified"]);
  });

  it("reports added and removed questions", () => {
    const proposed = proposedQuestion({ id: "q2", questionType: "true_or_false", title: "New" }, 0);
    const entries = diffQuestions([currentQuestion(live, 0)], proposed ? [proposed] : []);
    expect(entries.map((entry) => entry.status)).toEqual(["modified"]);

    const added = diffQuestions([], proposed ? [proposed] : []);
    expect(added.map((entry) => entry.status)).toEqual(["added"]);
    expect(diffQuestions([currentQuestion(live, 0)], []).map((entry) => entry.status)).toEqual([
      "removed",
    ]);
  });
});

describe("applyBlockReplacements", () => {
  it("swaps only the targeted block", () => {
    const html = '<p data-authoring-block-id="a">One</p><p data-authoring-block-id="b">Two</p>';
    const next = applyBlockReplacements(html, [
      { blockId: "b", html: '<p data-authoring-block-id="b">Deux</p>' },
    ]);
    expect(diffContentBlocks(html, next).map((entry) => entry.status)).toEqual([
      "unchanged",
      "modified",
    ]);
  });
});
