import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";

export const LOGO_LOCKED_CLASS = "email-template-logo-selected";

type LogoUrlLockOptions = {
  getLogoUrls: () => string[];
};

const readSrc = (attrs: Record<string, unknown> | null | undefined): string | null => {
  const src = attrs?.src;
  return typeof src === "string" ? src : null;
};

export const LogoUrlLockExtension = Extension.create<LogoUrlLockOptions>({
  name: "emailTemplateLogoUrlLock",

  addOptions() {
    return { getLogoUrls: () => [] };
  },

  addProseMirrorPlugins() {
    const getLogoUrls = () => new Set(this.options.getLogoUrls());

    return [
      new Plugin({
        key: new PluginKey("email-template-logo-url-lock"),

        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const logoUrls = getLogoUrls();
          if (logoUrls.size === 0) return null;

          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((newNode, pos) => {
            if (newNode.type.name !== EMAIL_TEMPLATE_NODE_TYPES.IMAGE) return;

            const oldNode = oldState.doc.nodeAt(pos);
            if (!oldNode || oldNode.type.name !== EMAIL_TEMPLATE_NODE_TYPES.IMAGE) return;

            const oldSrc = readSrc(oldNode.attrs);
            const newSrc = readSrc(newNode.attrs);
            if (oldSrc === newSrc) return;
            if (!oldSrc || !logoUrls.has(oldSrc)) return;

            tr.setNodeAttribute(pos, "src", oldSrc);
            modified = true;
          });

          return modified ? tr : null;
        },

        view(editorView) {
          const findContainer = () => editorView.dom.closest<HTMLElement>("#mly-editor");

          const applyClass = () => {
            const container = findContainer();
            if (!container) return;
            const logoUrls = getLogoUrls();
            const { selection } = editorView.state;
            const node = selection instanceof NodeSelection ? selection.node : null;
            const isLogo =
              node?.type.name === EMAIL_TEMPLATE_NODE_TYPES.IMAGE &&
              logoUrls.has(readSrc(node.attrs) ?? "");
            container.classList.toggle(LOGO_LOCKED_CLASS, isLogo);
          };
          applyClass();
          return {
            update: applyClass,
            destroy() {
              findContainer()?.classList.remove(LOGO_LOCKED_CLASS);
            },
          };
        },
      }),
    ];
  },
});
