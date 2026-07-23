import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { v4 as uuidv4 } from "uuid";

import type { JSONContent } from "@tiptap/core";

export const UUID_NODE_TYPES = [
  EMAIL_TEMPLATE_NODE_TYPES.HEADING,
  EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
  EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
  EMAIL_TEMPLATE_NODE_TYPES.FOOTER,
  EMAIL_TEMPLATE_NODE_TYPES.SECTION,
  EMAIL_TEMPLATE_NODE_TYPES.COLUMNS,
  EMAIL_TEMPLATE_NODE_TYPES.COLUMN,
  EMAIL_TEMPLATE_NODE_TYPES.DIVIDER,
  EMAIL_TEMPLATE_NODE_TYPES.SPACER,
  EMAIL_TEMPLATE_NODE_TYPES.HORIZONTAL_RULE,
] as const;

const UUID_ATTR = "uuid";
const UUID_DATA_ATTR = "data-uuid";

export const uuidPluginKey = new PluginKey("email-template-uuid");

const makeUuid = () => uuidv4();

const isTracked = (typeName: string) => (UUID_NODE_TYPES as readonly string[]).includes(typeName);

const stampMissingAndDuplicates = (
  doc: import("@tiptap/pm/model").Node,
): Array<{ pos: number; uuid: string }> => {
  const seen = new Set<string>();
  const positions: Array<{ pos: number; uuid: string | null }> = [];
  doc.descendants((node, pos) => {
    if (!isTracked(node.type.name)) return;
    const uuidAttr = (node.attrs?.[UUID_ATTR] ?? null) as string | null;
    positions.push({ pos, uuid: uuidAttr });
  });

  const updates: Array<{ pos: number; uuid: string }> = [];
  for (const { pos, uuid } of positions) {
    if (!uuid || seen.has(uuid)) {
      const fresh = makeUuid();
      seen.add(fresh);
      updates.push({ pos, uuid: fresh });
    } else {
      seen.add(uuid);
    }
  }
  return updates;
};

export const UuidExtension = Extension.create({
  name: "emailTemplateUuid",

  addGlobalAttributes() {
    return [
      {
        types: [...UUID_NODE_TYPES],
        attributes: {
          [UUID_ATTR]: {
            default: null,
            parseHTML: (element) => element.getAttribute(UUID_DATA_ATTR),
            renderHTML: (attrs) => {
              const value = attrs[UUID_ATTR];
              return value ? { [UUID_DATA_ATTR]: value } : {};
            },
            keepOnSplit: true,
          },
        },
      },
    ];
  },

  onCreate() {
    const updates = stampMissingAndDuplicates(this.editor.state.doc);
    if (!updates.length) return;
    const tr = this.editor.state.tr;
    for (const { pos, uuid } of updates) {
      const node = tr.doc.nodeAt(pos);
      if (!node) continue;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, [UUID_ATTR]: uuid });
    }
    if (tr.steps.length) this.editor.view.dispatch(tr);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: uuidPluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          const updates = stampMissingAndDuplicates(newState.doc);
          if (!updates.length) return null;

          const tr = newState.tr;
          for (const { pos, uuid } of updates) {
            const node = tr.doc.nodeAt(pos);
            if (!node) continue;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, [UUID_ATTR]: uuid });
          }
          return tr.steps.length ? tr : null;
        },
      }),
    ];
  },
});

export const stampContent = (json: JSONContent): JSONContent => {
  const seen = new Set<string>();

  const walk = (node: JSONContent): JSONContent => {
    const attrs = { ...(node.attrs ?? {}) };
    if (node.type && isTracked(node.type)) {
      const existing = attrs[UUID_ATTR] as string | null | undefined;
      if (!existing || seen.has(existing)) {
        attrs[UUID_ATTR] = makeUuid();
      }
      seen.add(attrs[UUID_ATTR] as string);
    }
    const content = node.content?.map(walk);
    return { ...node, attrs, ...(content ? { content } : {}) };
  };

  return walk(json);
};

export default UuidExtension;
