import type { Editor as TiptapEditor } from "@tiptap/react";

export type RichTextResourceNodeOptions = Record<string, never>;

type RemoveResourceNodeArgs = {
  editor: TiptapEditor;
  getPos: () => number;
  nodeSize: number;
};

const RESOURCE_URL_PATTERN =
  /\/api\/(?:lesson\/lesson-resource|articles\/articles-resource|news\/news-resource)\/([0-9a-fA-F-]{36})(?:[/?#].*)?$/;

export const extractResourceIdFromUrl = (src: string | null | undefined) => {
  if (!src) return null;

  return RESOURCE_URL_PATTERN.exec(src)?.[1] ?? null;
};

export const removeResourceNode = ({ editor, getPos, nodeSize }: RemoveResourceNodeArgs) => {
  const pos = getPos();

  editor
    .chain()
    .focus()
    .deleteRange({ from: pos, to: pos + nodeSize })
    .run();
};
