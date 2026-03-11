import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

type LoadingAiAssetAttrs = {
  placeholder: string | null;
};

const LOADING_AI_ASSET_NODE_TYPE = "loading-ai-asset";

const normalizeLoadingAiAssetAttrs = (attrs: {
  placeholder?: string | null;
}): LoadingAiAssetAttrs => ({
  placeholder: typeof attrs.placeholder === "string" ? attrs.placeholder : null,
});

const getLoadingAiAssetDataAttributes = (attrs: LoadingAiAssetAttrs) => ({
  "data-node-type": LOADING_AI_ASSET_NODE_TYPE,
  "data-placeholder": attrs.placeholder ?? "",
});

const getPlaceholderFromElement = (element: HTMLElement) =>
  element.getAttribute("data-placeholder") ?? element.getAttribute("data-placehoder");

const LoadingAiAssetCard = ({ text }: { text: string }) => (
  <div
    className={cn(
      "w-full rounded-md border border-primary-200 bg-white px-2 py-1.5 text-neutral-900",
    )}
  >
    <div className="flex min-w-0 items-center gap-2.5 pl-1">
      <span className="inline-flex size-6 shrink-0 items-center justify-center text-primary-700">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5">{text}</p>
      </div>
    </div>
  </div>
);

const LoadingAiAssetNodeView = ({ node }: NodeViewProps) => {
  const { t } = useTranslation();
  const attrs = normalizeLoadingAiAssetAttrs(node.attrs);

  if (!attrs.placeholder) return null;

  return (
    <NodeViewWrapper className="loading-ai-asset-node" contentEditable={false}>
      <div {...getLoadingAiAssetDataAttributes(attrs)}>
        <LoadingAiAssetCard text={t("richText.loadingAiAsset.processing")} />
      </div>
    </NodeViewWrapper>
  );
};

const baseLoadingAiAssetNodeConfig: NodeConfig = {
  name: "loadingAiAsset",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      placeholder: {
        default: null,
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: `div[data-node-type="${LOADING_AI_ASSET_NODE_TYPE}"]`,
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const placeholder = getPlaceholderFromElement(element);
          if (!placeholder) return false;

          return normalizeLoadingAiAssetAttrs({ placeholder });
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { placeholder, ...rest } = HTMLAttributes as Record<string, unknown>;

    const normalizedAttributes = normalizeLoadingAiAssetAttrs({
      placeholder: typeof placeholder === "string" ? placeholder : null,
    });

    return ["div", mergeAttributes(getLoadingAiAssetDataAttributes(normalizedAttributes), rest)];
  },
};

export const LoadingAiAssetEditor = Node.create({
  ...baseLoadingAiAssetNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(LoadingAiAssetNodeView);
  },
});

export const LoadingAiAssetViewer = Node.create({
  ...baseLoadingAiAssetNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(LoadingAiAssetNodeView);
  },
});
