import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { FileAudio, GripVertical, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { AudioPlayer } from "../components/AudioPlayer";

import { safeAudioSrc } from "./utils/audio";
import { removeResourceNode } from "./utils/resourceNode";

import type { RichTextResourceNodeOptions } from "./utils/resourceNode";
import type { NodeViewProps } from "@tiptap/react";

const AudioEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const { t } = useTranslation();
  const src = safeAudioSrc(node.attrs.src);
  const name = node.attrs.name || t("richText.audio.label");
  if (!src) return null;

  return (
    <NodeViewWrapper className="audio-node my-3 w-full max-w-full" contentEditable={false}>
      <div className="flex min-w-0 flex-col gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="rounded-full text-neutral-500 hover:bg-neutral-200"
            aria-label={t("richText.audio.drag")}
            data-drag-handle
          >
            <GripVertical className="size-4" aria-hidden />
          </Button>
          <FileAudio className="size-4 shrink-0 text-neutral-700" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-label={t("richText.audio.remove")}
            onClick={() => removeResourceNode({ editor, getPos, nodeSize: node.nodeSize })}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
        <AudioPlayer src={src} name={name} />
      </div>
    </NodeViewWrapper>
  );
};

const AudioViewerView = ({ node }: NodeViewProps) => {
  const { t } = useTranslation();
  const src = safeAudioSrc(node.attrs.src);
  const name = node.attrs.name || t("richText.audio.label");
  if (!src) return null;

  return (
    <NodeViewWrapper className="audio-node my-3 w-full max-w-full" contentEditable={false}>
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <FileAudio className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{name}</span>
        </div>
        <AudioPlayer src={src} name={name} />
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
    return ReactNodeViewRenderer(AudioEditorView);
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

export const AudioEmbedViewer = AudioEmbedEditor.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AudioViewerView);
  },
});
