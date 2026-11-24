import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { FileAudio, GripVertical, X } from "lucide-react";
import { useContext } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { AudioPlayer } from "../components/AudioPlayer";
import { TrackedAudioPlayer } from "../components/TrackedAudioPlayer";
import {
  RichTextAuthoringAssetUrlsContext,
  RichTextMediaUrlsContext,
} from "../contentPolicyContext";

import {
  getAudioCoverageAttrsFromElement,
  getAudioCoverageDataAttributes,
  normalizeAudioCoverageAttributes,
  safeAudioSrc,
} from "./utils/audio";
import { removeResourceNode } from "./utils/resourceNode";

import type { RichTextResourceNodeOptions } from "./utils/resourceNode";
import type { SupportedLanguages } from "@repo/shared";
import type { NodeViewProps } from "@tiptap/react";
import type { VideoCoverageSnapshotChange } from "~/components/VideoPlayer/videoCoverage.types";

type AudioViewerOptions = {
  audioCoverageTracking?: {
    enabled: boolean;
    showCoverageMarkers?: boolean;
    lessonId?: string;
    learningStateId?: string | null;
    language?: SupportedLanguages;
    onSnapshotChange?: (change: VideoCoverageSnapshotChange) => void;
    onAudioActivated?: (resourceEntityId: string) => void;
  };
};

/** Use temporary preview URLs only inside the authoring media policy that created them. */
const useAudioNodeSource = (source: unknown, assetId: unknown): string | null => {
  const allowed = useContext(RichTextMediaUrlsContext);
  const previews = useContext(RichTextAuthoringAssetUrlsContext);
  if (typeof assetId === "string" && previews?.[assetId]) return previews[assetId];
  const resource = safeAudioSrc(source);
  return resource && (!allowed || allowed.has(resource)) ? resource : null;
};

const AudioEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const { t } = useTranslation();
  const src = useAudioNodeSource(node.attrs.src, node.attrs.authoringAssetId);
  const name = node.attrs.name || t("richText.audio.label");
  if (!src && !node.attrs.authoringAssetId) return null;
  if (!src) {
    return (
      <NodeViewWrapper contentEditable={false} role="status">
        <p>
          {name} · {t("courseAuthoring.review.waiting")}
        </p>
      </NodeViewWrapper>
    );
  }

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

const AudioViewerView = ({ node, extension }: NodeViewProps) => {
  const { t } = useTranslation();
  const { audioCoverageTracking } = extension.options as AudioViewerOptions;
  const src = useAudioNodeSource(node.attrs.src, node.attrs.authoringAssetId);
  const name = node.attrs.name || t("richText.audio.label");
  if (!src && !node.attrs.authoringAssetId) return null;
  if (!src) {
    return (
      <NodeViewWrapper contentEditable={false} role="status">
        <p>
          {name} · {t("courseAuthoring.review.waiting")}
        </p>
      </NodeViewWrapper>
    );
  }

  const coverageAttrs = normalizeAudioCoverageAttributes(node.attrs);

  return (
    <NodeViewWrapper className="audio-node my-3 w-full max-w-full" contentEditable={false}>
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <FileAudio className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{name}</span>
        </div>
        {audioCoverageTracking?.enabled && coverageAttrs.resourceEntityId ? (
          <TrackedAudioPlayer
            src={src}
            name={name}
            resourceEntityId={coverageAttrs.resourceEntityId}
            coverageTracking={{
              enabled: true,
              showCoverageMarkers: audioCoverageTracking.showCoverageMarkers,
              lessonId: audioCoverageTracking.lessonId,
              learningStateId: audioCoverageTracking.learningStateId,
              language: audioCoverageTracking.language,
              initialCoveragePercent: coverageAttrs.audioCoveragePercent ?? 0,
              initialWatchedRanges: coverageAttrs.audioListenedRanges,
              initialIsWatched: coverageAttrs.audioIsListened,
              initialDurationSeconds: coverageAttrs.audioDurationSeconds,
              initialBucketSizeSeconds: coverageAttrs.audioBucketSizeSeconds,
              onSnapshotChange: audioCoverageTracking.onSnapshotChange,
              onVideoActivated: audioCoverageTracking.onAudioActivated,
            }}
          />
        ) : (
          <AudioPlayer src={src} name={name} />
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
    return ReactNodeViewRenderer(AudioEditorView);
  },
  addAttributes() {
    return {
      src: { default: null },
      authoringAssetId: { default: null },
      name: { default: null },
      resourceEntityId: { default: null },
      audioCoveragePercent: { default: null },
      audioIsListened: { default: false },
      audioListenedRanges: { default: [] },
      audioDurationSeconds: { default: null },
      audioBucketSizeSeconds: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'audio[data-node-type="audio"]',
        getAttrs: (element) => {
          const rawSrc = element.getAttribute("src");
          const marker = element.getAttribute("data-authoring-asset-id");
          const authoringAssetId = marker && /^[0-9a-f-]{36}$/i.test(marker) ? marker : null;
          const src = safeAudioSrc(rawSrc);
          return src || authoringAssetId
            ? {
                src,
                authoringAssetId,
                name: element.getAttribute("data-name"),
                ...getAudioCoverageAttrsFromElement(element),
              }
            : false;
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
        ...(node.attrs.authoringAssetId
          ? { "data-authoring-asset-id": node.attrs.authoringAssetId }
          : {}),
        "data-name": node.attrs.name,
        ...getAudioCoverageDataAttributes(normalizeAudioCoverageAttributes(node.attrs)),
        controls: "",
        preload: "metadata",
      },
    ];
  },
});

export const AudioEmbedViewer = AudioEmbedEditor.extend<AudioViewerOptions>({
  addOptions() {
    return {
      audioCoverageTracking: undefined,
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioViewerView);
  },
});
