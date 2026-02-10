import { VIDEO_AUTOPLAY, type VideoAutoplay } from "@repo/shared";
import { load as loadHtml } from "cheerio";

import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

const normalizeTextContent = (value: string) => value.replace(/\u00A0/g, " ").trim();

const isMeaningfulElement = (html: CheerioAPI, element: AnyNode): boolean => {
  if (element.type === "text") {
    return normalizeTextContent(html(element).text()).length > 0;
  }

  const attributes = "attribs" in element ? (element.attribs ?? {}) : {};
  if (Object.keys(attributes).length > 0) return true;

  if (normalizeTextContent(html(element).text()).length > 0) return true;

  const children = html(element).children().toArray();
  return children.some((child) => isMeaningfulElement(html, child));
};

const getVideoAutoplayAction = (
  shouldAutoplay: boolean,
  shouldPlayNext: boolean,
): VideoAutoplay => {
  if (shouldAutoplay && shouldPlayNext) return VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT;
  if (shouldAutoplay) return VIDEO_AUTOPLAY.AUTOPLAY;
  if (shouldPlayNext) return VIDEO_AUTOPLAY.PLAY_NEXT;
  return VIDEO_AUTOPLAY.NO_AUTOPLAY;
};

export const annotateVideoAutoplayInContent = (content: string | null): string | null => {
  if (!content) return content;

  const $ = loadHtml(content);
  const bodyChildren = $("body").children();
  const nodes = (bodyChildren.length ? bodyChildren : $.root().children()).toArray();

  const nodeMeta = nodes.map((element) => {
    const nodeType = $(element).attr("data-node-type");
    const isVideo = nodeType === "video";
    const isMeaningful = isVideo || isMeaningfulElement($, element);
    return { element, isVideo, isMeaningful };
  });

  const meaningfulIndexes = nodeMeta
    .map((node, index) => (node.isMeaningful ? index : null))
    .filter((index): index is number => index !== null);

  const getNextMeaningfulIndex = (currentIndex: number) =>
    meaningfulIndexes.find((index) => index > currentIndex) ?? null;

  const getPrevMeaningfulIndex = (currentIndex: number) => {
    for (let i = meaningfulIndexes.length - 1; i >= 0; i -= 1) {
      const index = meaningfulIndexes[i];
      if (index < currentIndex) return index;
    }
    return null;
  };

  nodeMeta.forEach((node, index) => {
    if (!node.isVideo) return;

    const prevMeaningfulIndex = getPrevMeaningfulIndex(index);
    const nextMeaningfulIndex = getNextMeaningfulIndex(index);
    const nextIsVideo =
      nextMeaningfulIndex !== null ? nodeMeta[nextMeaningfulIndex]?.isVideo === true : false;

    const shouldAutoplay = prevMeaningfulIndex === null;
    const shouldPlayNext = nextMeaningfulIndex === null || nextIsVideo;
    const action = getVideoAutoplayAction(shouldAutoplay, shouldPlayNext);

    $(node.element).attr("data-autoplay", action);
  });

  return $.html(bodyChildren.length ? bodyChildren : $.root().children());
};
