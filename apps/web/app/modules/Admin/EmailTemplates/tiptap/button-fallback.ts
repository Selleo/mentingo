import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const FALLBACK_ATTR = "fallbackText";
const FALLBACK_DATA_ATTR = "data-fallback-text";
const UUID_ATTR = "uuid";

const attrPluginKey = new PluginKey("email-template-button-fallback-attr");
const decoPluginKey = new PluginKey("email-template-button-fallback-deco");

export const ButtonFallbackExtension = Extension.create({
  name: "emailTemplateButtonFallback",

  addGlobalAttributes() {
    return [
      {
        types: [EMAIL_TEMPLATE_NODE_TYPES.BUTTON],
        attributes: {
          [FALLBACK_ATTR]: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute(FALLBACK_DATA_ATTR) === "true" ? "true" : null,
            renderHTML: () => ({}),
            keepOnSplit: true,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: attrPluginKey,
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const oldByUuid = new Map<string, string>();
          oldState.doc.descendants((node) => {
            if (node.type.name !== EMAIL_TEMPLATE_NODE_TYPES.BUTTON) return;
            const uuid = node.attrs?.[UUID_ATTR] as string | undefined;
            if (uuid) oldByUuid.set(uuid, (node.attrs?.text as string) ?? "");
          });

          const clears: Array<{ pos: number; attrs: Record<string, unknown> }> = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== EMAIL_TEMPLATE_NODE_TYPES.BUTTON) return;
            if (node.attrs?.[FALLBACK_ATTR] !== "true") return;
            const uuid = node.attrs?.[UUID_ATTR] as string | undefined;
            if (!uuid) return;
            const prev = oldByUuid.get(uuid);
            if (prev !== undefined && prev !== (node.attrs?.text as string)) {
              clears.push({ pos, attrs: { ...node.attrs, [FALLBACK_ATTR]: null } });
            }
          });

          if (!clears.length) return null;
          const tr = newState.tr;
          for (const { pos, attrs } of clears) tr.setNodeMarkup(pos, undefined, attrs);
          return tr;
        },
      }),
      new Plugin({
        key: decoPluginKey,
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== EMAIL_TEMPLATE_NODE_TYPES.BUTTON) return;
              if (node.attrs?.[FALLBACK_ATTR] !== "true") return;
              decos.push(
                Decoration.node(pos, pos + node.nodeSize, { [FALLBACK_DATA_ATTR]: "true" }),
              );
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

export default ButtonFallbackExtension;
