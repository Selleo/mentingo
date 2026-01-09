import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Video as VideoIcon } from "lucide-react";

import { Video } from "~/components/VideoPlayer/Video";

import {
  VIDEO_NODE_TYPE,
  getVideoEmbedAttrsFromElement,
  normalizeVideoEmbedAttributes,
  type VideoEmbedAttrs,
  type VideoProvider,
  type VideoSourceType,
} from "./utils/video";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

type VideoViewerOptions = {
  onVideoEnded?: () => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      setVideoEmbed: (
        attrs: Partial<VideoEmbedAttrs> & { src: string; sourceType?: VideoSourceType },
      ) => ReturnType;
    };
  }
}

const getVideoDataAttributes = (attrs: VideoEmbedAttrs) => ({
  "data-node-type": VIDEO_NODE_TYPE,
  "data-source-type": attrs.sourceType,
  "data-provider": attrs.provider,
  "data-src": attrs.src ?? "",
});

const VideoEditorView = ({ node }: NodeViewProps) => {
  const attrs = normalizeVideoEmbedAttributes(node.attrs);

  if (!attrs.src) return null;

  return (
    <NodeViewWrapper className="video-node">
      <a
        {...getVideoDataAttributes(attrs)}
        href={attrs.src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-2 rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-primary-700 underline"
        contentEditable={false}
      >
        <VideoIcon className="size-4 text-primary-700" aria-hidden />
        <span className="truncate">{attrs.src}</span>
      </a>
    </NodeViewWrapper>
  );
};

const VideoViewerView = ({ node, extension }: NodeViewProps) => {
  const attrs = normalizeVideoEmbedAttributes(node.attrs);
  const { onVideoEnded } = extension.options as VideoViewerOptions;

  if (!attrs.src) return null;

  return (
    <NodeViewWrapper className="video-node">
      <Video
        src={attrs.src}
        isExternal={attrs.sourceType === "external"}
        onVideoEnded={onVideoEnded}
      />
    </NodeViewWrapper>
  );
};

const baseVideoNodeConfig: NodeConfig = {
  name: "video",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      sourceType: {
        default: "external",
      },
      provider: {
        default: "unknown",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-node-type="video"]',
        getAttrs: (el) => {
          return getVideoEmbedAttrsFromElement(el as HTMLElement);
        },
      },
      {
        tag: 'a[data-node-type="video"]',
        getAttrs: (el) => {
          return getVideoEmbedAttrsFromElement(el as HTMLElement);
        },
      },
      {
        tag: 'div[data-type="video"]',
        getAttrs: (el) => {
          return getVideoEmbedAttrsFromElement(el as HTMLElement);
        },
      },
      {
        tag: "video",
        getAttrs: (el) => {
          return getVideoEmbedAttrsFromElement(el as HTMLElement);
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, sourceType, provider, ...rest } = HTMLAttributes as Record<string, unknown>;
    const normalized = normalizeVideoEmbedAttributes({
      src: typeof src === "string" ? src : null,
      sourceType: sourceType as VideoSourceType,
      provider: provider as VideoProvider,
    });

    return ["div", mergeAttributes(getVideoDataAttributes(normalized), rest)];
  },

  addCommands() {
    return {
      setVideoEmbed:
        (attrs) =>
        ({ commands }) => {
          const normalized = normalizeVideoEmbedAttributes(attrs);
          if (!normalized.src) return false;

          return commands.insertContent({
            type: this.name,
            attrs: normalized,
          });
        },
    };
  },
};

export const VideoEmbedEditor = Node.create({
  ...baseVideoNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(VideoEditorView);
  },
});

export const VideoEmbedViewer = Node.create<VideoViewerOptions>({
  ...baseVideoNodeConfig,
  addOptions() {
    return {
      onVideoEnded: undefined,
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoViewerView);
  },
});
