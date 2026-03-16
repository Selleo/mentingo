import { VIDEO_AUTOPLAY } from "@repo/shared";
import { load as loadHtml } from "cheerio";

import { annotateVideoAutoplayAndBlockIndexesInContent } from "../annotateVideoAutoplayAndBlockIndexesInContent";

const getVideoAutoplayActions = (html: string) => {
  const $ = loadHtml(html);
  return $("div[data-node-type='video']")
    .toArray()
    .map((video) => $(video).attr("data-autoplay"));
};

const getTopLevelBlockIndexes = (html: string) => {
  const $ = loadHtml(html);
  const bodyChildren = $("body").children();
  const rootChildren = bodyChildren.length ? bodyChildren : $.root().children();
  return rootChildren.toArray().map((block) => $(block).attr("data-block-index"));
};

describe("annotateVideoAutoplayAndBlockIndexesInContent", () => {
  it("does not autoplay first video when there is meaningful content before it", () => {
    const content = [
      "<p>Intro text.</p>",
      '<div data-node-type="video" data-src="https://example.com/1"></div>',
      "<p>Meaningful text between videos.</p>",
      '<div data-node-type="video" data-src="https://example.com/2"></div>',
    ].join("");

    const annotated = annotateVideoAutoplayAndBlockIndexesInContent(content);

    expect(annotated).not.toBeNull();
    expect(getVideoAutoplayActions(annotated!)).toEqual([
      VIDEO_AUTOPLAY.NO_AUTOPLAY,
      VIDEO_AUTOPLAY.PLAY_NEXT,
    ]);
  });

  it("does not chain play_next when meaningful text is between videos and video is first", () => {
    const content = [
      '<div data-node-type="video" data-src="https://example.com/1"></div>',
      "<p>Meaningful text between videos.</p>",
      '<div data-node-type="video" data-src="https://example.com/2"></div>',
    ].join("");

    const annotated = annotateVideoAutoplayAndBlockIndexesInContent(content);

    expect(annotated).not.toBeNull();
    expect(getVideoAutoplayActions(annotated!)).toEqual([
      VIDEO_AUTOPLAY.AUTOPLAY,
      VIDEO_AUTOPLAY.PLAY_NEXT,
    ]);
  });

  it("keeps chaining when only empty spacing is between videos and video is first", () => {
    const content = [
      '<div data-node-type="video" data-src="https://example.com/1"></div>',
      "<p></p>",
      '<div data-node-type="video" data-src="https://example.com/2"></div>',
    ].join("");

    const annotated = annotateVideoAutoplayAndBlockIndexesInContent(content);

    expect(annotated).not.toBeNull();
    expect(getVideoAutoplayActions(annotated!)).toEqual([
      VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT,
      VIDEO_AUTOPLAY.PLAY_NEXT,
    ]);
  });

  it("adds data-block-index to top-level blocks only", () => {
    const content = ["<h1>hi</h1>", "<h2>cool</h2>", "<div><p>nested</p></div>"].join("");

    const annotated = annotateVideoAutoplayAndBlockIndexesInContent(content);
    const $ = loadHtml(annotated!);

    expect(annotated).not.toBeNull();
    expect(getTopLevelBlockIndexes(annotated!)).toEqual(["0", "1", "2"]);
    expect($("h1").attr("data-block-index")).toBe("0");
    expect($("h2").attr("data-block-index")).toBe("1");
    expect($("div").attr("data-block-index")).toBe("2");
    expect($("p").attr("data-block-index")).toBeUndefined();
  });
});
