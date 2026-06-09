import { VIDEO_AUTOPLAY } from "@repo/shared";
import { load as loadHtml } from "cheerio";

import { createLessonResourceIdRegex } from "src/lesson/lesson-resource-references";

import { injectResourcesIntoContent } from "../injectResourcesIntoContent";

const resourceA = "11111111-1111-1111-1111-111111111111";
const resourceB = "22222222-2222-2222-2222-222222222222";

const getVideoAutoplayActions = (html: string) => {
  const $ = loadHtml(html);
  return $("div[data-node-type='video']")
    .toArray()
    .map((video) => $(video).attr("data-autoplay"));
};

describe("injectResourcesIntoContent", () => {
  it("counts image nodes without rewriting image resource anchors when disabled", () => {
    const content = [
      `<div data-node-type="image" data-src="/api/lesson/lesson-resource/${resourceA}" data-resource-id="${resourceA}" data-alt="Diagram"></div>`,
      `<p><a href="/api/lesson/lesson-resource/${resourceB}" data-resource-id="${resourceB}">Legacy image</a></p>`,
    ].join("");

    const result = injectResourcesIntoContent(
      content,
      [
        { id: resourceA, fileUrl: "https://cdn.example.com/a.png", contentType: "image/png" },
        { id: resourceB, fileUrl: "https://cdn.example.com/b.png", contentType: "image/png" },
      ],
      {
        resourceIdRegex: createLessonResourceIdRegex(),
        trackNodeTypes: ["image"],
        convertImageAnchors: false,
      },
    );

    expect(result.contentCount.image).toBe(1);
    expect(result.html).toContain('data-node-type="image"');
    expect(result.html).toContain(">Legacy image</a>");
  });

  it("keeps legacy image anchor conversion available by default", () => {
    const content = `<p><a href="/api/lesson/lesson-resource/${resourceA}" data-resource-id="${resourceA}">Legacy image</a></p>`;

    const result = injectResourcesIntoContent(
      content,
      [{ id: resourceA, fileUrl: "https://cdn.example.com/a.png", contentType: "image/png" }],
      {
        resourceIdRegex: createLessonResourceIdRegex(),
      },
    );

    expect(result.contentCount.image).toBe(1);
    expect(result.html).toContain('<img src="https://cdn.example.com/a.png" alt="">');
  });

  it("normalizes stale autoplay metadata while injecting resources", () => {
    const content = [
      "<p>Intro text.</p>",
      `<div data-node-type="video" data-src="http://localhost:5173/api/lesson/lesson-resource/${resourceA}" data-autoplay="autoplay_with_play_next"></div>`,
      "<p>Meaningful text between videos.</p>",
      `<div data-node-type="video" data-src="http://localhost:5173/api/lesson/lesson-resource/${resourceB}" data-autoplay="play_next"></div>`,
    ].join("");

    const result = injectResourcesIntoContent(
      content,
      [
        { id: resourceA, fileUrl: "https://cdn.example.com/a.mp4", contentType: "video/mp4" },
        { id: resourceB, fileUrl: "https://cdn.example.com/b.mp4", contentType: "video/mp4" },
      ],
      {
        resourceIdRegex: createLessonResourceIdRegex(),
        trackNodeTypes: ["video"],
      },
    );

    expect(result.html).not.toBeNull();
    expect(getVideoAutoplayActions(result.html!)).toEqual([
      VIDEO_AUTOPLAY.NO_AUTOPLAY,
      VIDEO_AUTOPLAY.PLAY_NEXT,
    ]);
    expect(result.hasAutoplayTrigger).toBe(false);
    expect(result.videos).toEqual([
      `http://localhost:5173/api/lesson/lesson-resource/${resourceA}`,
      `http://localhost:5173/api/lesson/lesson-resource/${resourceB}`,
    ]);
  });
});
