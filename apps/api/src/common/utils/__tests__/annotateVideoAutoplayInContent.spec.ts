import { VIDEO_AUTOPLAY } from "@repo/shared";
import { load as loadHtml } from "cheerio";

import { annotateVideoAutoplayInContent } from "../annotateVideoAutoplayInContent";

const getVideoAutoplayActions = (html: string) => {
  const $ = loadHtml(html);
  return $("div[data-node-type='video']")
    .toArray()
    .map((video) => $(video).attr("data-autoplay"));
};

describe("annotateVideoAutoplayInContent", () => {
  it("does not autoplay first video when there is meaningful content before it", () => {
    const content = [
      "<p>Intro text.</p>",
      '<div data-node-type="video" data-src="https://example.com/1"></div>',
      "<p>Meaningful text between videos.</p>",
      '<div data-node-type="video" data-src="https://example.com/2"></div>',
    ].join("");

    const annotated = annotateVideoAutoplayInContent(content);

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

    const annotated = annotateVideoAutoplayInContent(content);

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

    const annotated = annotateVideoAutoplayInContent(content);

    expect(annotated).not.toBeNull();
    expect(getVideoAutoplayActions(annotated!)).toEqual([
      VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT,
      VIDEO_AUTOPLAY.PLAY_NEXT,
    ]);
  });
});
