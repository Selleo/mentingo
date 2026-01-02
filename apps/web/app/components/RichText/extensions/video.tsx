import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

import { Video } from "~/components/VideoPlayer/Video";

import type { NodeViewProps } from "@tiptap/react";

type VideoOptions = {
  onVideoEnded?: () => void;
};

const VideoView = ({ node, extension }: NodeViewProps) => {
  const url = node.attrs.url as string | null;
  const isExternalUrl = Boolean(node.attrs.isExternalUrl);
  const onVideoEnded = (extension.options as VideoOptions).onVideoEnded;

  if (!url) return null;

  return (
    <NodeViewWrapper className="video-node">
      <Video url={url} isExternalUrl={isExternalUrl} onVideoEnded={onVideoEnded} />
    </NodeViewWrapper>
  );
};

export const VideoNode = Node.create<VideoOptions>({
  name: "video",
  group: "block",
  atom: true,
  selectable: true,

  addOptions() {
    return {
      onVideoEnded: undefined,
    };
  },

  addAttributes() {
    return {
      url: {
        default: null,
      },
      isExternalUrl: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-external") === "true",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="video"]',
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const url = element.getAttribute("data-url");

          if (!url) return false;

          return {
            url,
            isExternalUrl: element.getAttribute("data-external") === "true",
          };
        },
      },
      {
        tag: "video",
        getAttrs: (el) => {
          const element = el as HTMLVideoElement;
          const url = element.getAttribute("src");

          if (!url) return false;

          return {
            url,
            isExternalUrl: true,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { url, isExternalUrl, ...rest } = HTMLAttributes as Record<string, unknown>;

    return [
      "div",
      mergeAttributes(
        {
          "data-type": "video",
          "data-url": typeof url === "string" ? url : "",
          "data-external": isExternalUrl ? "true" : "false",
        },
        rest,
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
});
