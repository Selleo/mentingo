import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { baseUrl } from "~/utils/baseUrl";

import { removeResourceNode } from "./utils/resourceNode";

const safeAudioSrc = (src: unknown): string | null => {
  if (typeof src !== "string" || (!src.startsWith("/") && !/^https?:\/\//i.test(src))) return null;
  try {
    const origin = new URL(baseUrl).origin;
    const url = new URL(src, origin);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash)
      return null;
    if (!/^\/api\/lesson\/lesson-resource\/[0-9a-f-]{36}$/i.test(url.pathname)) return null;
    return src;
  } catch {
    return null;
  }
};

import type { RichTextResourceNodeOptions } from "./utils/resourceNode";
import type { NodeViewProps } from "@tiptap/react";

const AudioView = ({ node, editor, getPos }: NodeViewProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const src = safeAudioSrc(node.attrs.src);
  const name = node.attrs.name || t("richText.audio.label");
  if (!src) return null;

  return (
    <NodeViewWrapper className="audio-node my-3 min-w-0 w-full max-w-full" contentEditable={false}>
      <div className="min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          {editor.isEditable && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              data-drag-handle
              aria-label={t("richText.audio.drag")}
            >
              <GripVertical className="size-4" aria-hidden />
            </Button>
          )}
          <p className="m-0 min-w-0 flex-1 break-words text-sm font-medium">{name}</p>
          {editor.isEditable && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-label={t("richText.audio.remove")}
              onClick={() => removeResourceNode({ editor, getPos, nodeSize: node.nodeSize })}
            >
              <X className="size-4" aria-hidden />
            </Button>
          )}
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Audio uploads do not include a text track. */}
        <audio
          key={src}
          src={src}
          aria-label={name}
          controls
          preload="metadata"
          className="block w-full max-w-full"
          onLoadStart={() => setStatus("loading")}
          onWaiting={() => setStatus("loading")}
          onLoadedMetadata={() => setStatus("ready")}
          onCanPlay={() => setStatus("ready")}
          onPlaying={() => setStatus("ready")}
          onError={() => setStatus("error")}
        >
          {t("richText.audio.unsupported")}
        </audio>
        {status === "loading" && (
          <p role="status" className="m-0 mt-2 text-sm">
            {t("richText.audio.loading")}
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="m-0 mt-2 text-sm text-error-600">
            {t("richText.audio.error")}
          </p>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const AudioEmbedEditor = Node.create<RichTextResourceNodeOptions>({
  name: "audio",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addOptions() {
    return {};
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioView);
  },
  addAttributes() {
    return {
      src: { default: null },
      name: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'audio[data-node-type="audio"]',
        getAttrs: (element) => {
          const src = safeAudioSrc(element.getAttribute("src"));
          return src ? { src, name: element.getAttribute("data-name") } : false;
        },
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "audio",
      {
        "data-node-type": "audio",
        src: safeAudioSrc(node.attrs.src),
        "data-name": node.attrs.name,
        controls: "",
        preload: "metadata",
      },
    ];
  },
});

export const AudioEmbedViewer = AudioEmbedEditor.extend({});
