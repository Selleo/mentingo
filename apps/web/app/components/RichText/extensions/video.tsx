import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { GripVertical, Video as VideoIcon, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Video } from "~/components/VideoPlayer/Video";
import { cn } from "~/lib/utils";

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
  ...(attrs.hasError ? { "data-error": "true" } : {}),
});

const VideoEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const attrs = normalizeVideoEmbedAttributes(node.attrs);

  if (!attrs.src) return null;

  const handleRemove = () => {
    const pos = getPos();

    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  };

  return (
    <NodeViewWrapper className="video-node">
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-primary-700",
          attrs.hasError && "border-red-500 border-2 bg-red-500/10",
        )}
      >
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="rounded-full text-neutral-500 hover:bg-neutral-200"
          aria-label="Drag video embed"
          data-drag-handle
        >
          <GripVertical className="size-4" aria-hidden />
        </Button>
        <a
          {...getVideoDataAttributes(attrs)}
          href={attrs.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-2 underline"
          contentEditable={false}
        >
          <VideoIcon className="size-4 text-primary-700" aria-hidden />
          <span className="truncate">{attrs.src}</span>
        </a>
        <Button
          type="button"
          onClick={handleRemove}
          aria-label="Remove video embed"
          size="xs"
          variant="ghost"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </div>
    </NodeViewWrapper>
  );
};

const VideoViewerView = ({ node, extension }: NodeViewProps) => {
  const attrs = normalizeVideoEmbedAttributes(node.attrs);
  const { onVideoEnded } = extension.options as VideoViewerOptions;

  if (!attrs.src) return null;

  if (attrs.hasError) return null;

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
      hasError: {
        default: false,
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
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, sourceType, provider, hasError, ...rest } = HTMLAttributes as Record<
      string,
      unknown
    >;

    const normalized = normalizeVideoEmbedAttributes({
      src: typeof src === "string" ? src : null,
      sourceType: sourceType as VideoSourceType,
      provider: provider as VideoProvider,
      hasError: hasError as boolean,
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
