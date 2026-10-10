import { Extension } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode, Slice } from "@tiptap/pm/model";
import { Plugin, type Transaction } from "@tiptap/pm/state";

export const AUTHORING_BLOCK_ID_ATTRIBUTE = "data-authoring-block-id";

const AUTHORING_BLOCK_NODE_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "codeBlock",
  "horizontalRule",
  "taskList",
  "table",
  "iframe",
  "downloadableFile",
  "loadingAiAsset",
  "image",
  "pdfPreview",
  "presentation",
  "video",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createAuthoringBlockId = () => globalThis.crypto.randomUUID();

type AuthoringBlockIdOptions = {
  generateIds: boolean;
};

const stripAuthoringBlockIds = (fragment: Fragment): Fragment =>
  Fragment.fromArray(
    fragment.content.map((node) => {
      const content = node.content.size ? stripAuthoringBlockIds(node.content) : node.content;
      if (!("authoringBlockId" in node.attrs) && content === node.content) return node;

      return node.type.create(
        { ...node.attrs, authoringBlockId: null },
        content,
        node.marks,
      );
    }),
  );

const normalizeAuthoringBlockIds = (
  document: ProseMirrorNode,
  transaction: Transaction,
): Transaction | null => {
  const seenIds = new Set<string>();
  let changed = false;

  document.descendants((node, position, parent) => {
    if (!("authoringBlockId" in node.attrs)) return;

    const currentId = node.attrs.authoringBlockId;
    const isTopLevel = parent === document;
    const hasValidUniqueId =
      typeof currentId === "string" && UUID_PATTERN.test(currentId) && !seenIds.has(currentId);

    if (!isTopLevel) {
      if (currentId !== null) {
        transaction.setNodeMarkup(position, undefined, { ...node.attrs, authoringBlockId: null });
        changed = true;
      }
      return;
    }

    const nextId = hasValidUniqueId ? currentId : createAuthoringBlockId();
    seenIds.add(nextId);

    if (nextId !== currentId) {
      transaction.setNodeMarkup(position, undefined, { ...node.attrs, authoringBlockId: nextId });
      changed = true;
    }
  });

  return changed ? transaction : null;
};

export const AuthoringBlockId = Extension.create<AuthoringBlockIdOptions>({
  name: "authoringBlockId",

  addOptions() {
    return { generateIds: true };
  },

  addGlobalAttributes() {
    return [
      {
        types: AUTHORING_BLOCK_NODE_TYPES,
        attributes: {
          authoringBlockId: {
            default: null,
            parseHTML: (element) => element.getAttribute(AUTHORING_BLOCK_ID_ATTRIBUTE),
            renderHTML: (attributes) =>
              attributes.authoringBlockId
                ? { [AUTHORING_BLOCK_ID_ATTRIBUTE]: attributes.authoringBlockId }
                : {},
          },
        },
      },
    ];
  },

  onCreate() {
    if (!this.options.generateIds) return;
    const transaction = normalizeAuthoringBlockIds(this.editor.state.doc, this.editor.state.tr);
    if (transaction) this.editor.view.dispatch(transaction);
  },

  addProseMirrorPlugins() {
    if (!this.options.generateIds) return [];
    return [
      new Plugin({
        props: {
          transformPasted: (slice: Slice) =>
            slice.content.size
              ? new Slice(
                  stripAuthoringBlockIds(slice.content),
                  slice.openStart,
                  slice.openEnd,
                )
              : slice,
        },
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null;
          return normalizeAuthoringBlockIds(newState.doc, newState.tr);
        },
      }),
    ];
  },
});
