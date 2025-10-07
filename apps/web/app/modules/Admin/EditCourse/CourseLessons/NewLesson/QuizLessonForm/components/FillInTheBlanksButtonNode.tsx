import { Node, NodeViewWrapper, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react";

import { FILL_IN_THE_BLANKS_BUTTON_CLASSNAME } from "./constants";

export const X_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M11.1675 0.565887C11.2025 0.565909 11.2376 0.572959 11.27 0.586395C11.3023 0.599831 11.3312 0.620225 11.356 0.644989C11.3807 0.669747 11.4012 0.698593 11.4146 0.730927C11.4279 0.763315 11.4341 0.798418 11.4341 0.833466C11.4341 0.868524 11.427 0.903619 11.4136 0.936005C11.4069 0.952082 11.3988 0.967499 11.3892 0.981903L11.356 1.02194L6.73096 5.64597L6.37646 6.00046L6.73096 6.35397L11.356 10.978C11.406 11.028 11.434 11.0957 11.4341 11.1665C11.4341 11.2373 11.406 11.3049 11.356 11.3549C11.3059 11.405 11.2383 11.434 11.1675 11.4341C11.0968 11.4341 11.0291 11.4057 10.979 11.3559L5.99951 6.37643L5.646 6.73093L1.02197 11.3559C0.997294 11.3805 0.968201 11.4002 0.936035 11.4135C0.903623 11.427 0.868566 11.434 0.833496 11.4341C0.762569 11.4341 0.694202 11.4061 0.644043 11.3559C0.619235 11.3311 0.59986 11.3014 0.586426 11.269C0.572985 11.2366 0.565918 11.2016 0.565918 11.1665C0.565943 11.1314 0.57301 11.0963 0.586426 11.0639C0.599802 11.0318 0.619457 11.0027 0.644043 10.978L5.27002 6.35397L5.62354 6.00046L5.27002 5.64597L0.644043 1.02194H0.643066C0.593468 0.9719 0.565953 0.903952 0.565918 0.833466C0.565918 0.762534 0.593887 0.694168 0.644043 0.644012C0.694199 0.593857 0.762565 0.565887 0.833496 0.565887C0.904212 0.565922 0.971883 0.594111 1.02197 0.644012L5.646 5.26999L5.99951 5.6235L6.354 5.26999L10.979 0.644012C11.0037 0.619476 11.0328 0.599724 11.0649 0.586395C11.0973 0.573005 11.1324 0.565872 11.1675 0.565887Z" fill="#121521" stroke="currentColor"/></svg>`;

import type { NodeViewProps } from "@tiptap/react";

const FillInTheBlanksButton = ({ node, getPos, editor }: NodeViewProps) => {
  const word = node.attrs.word;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (getPos && editor) {
      const pos = getPos();
      editor.commands.deleteRange({ from: pos, to: pos + 1 });
    }
  };

  return (
    <NodeViewWrapper
      as="button"
      type="button"
      className={FILL_IN_THE_BLANKS_BUTTON_CLASSNAME}
      data-word={word}
      onClick={handleClick}
    >
      <span>{word}</span>
      <span className="cursor-pointer" dangerouslySetInnerHTML={{ __html: X_ICON_SVG }} />
    </NodeViewWrapper>
  );
};

export const FillInTheBlanksButtonNode = Node.create({
  name: "button",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      word: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "button",
        getAttrs: (el) => {
          const element = el as HTMLElement;
          if (element.classList.contains("bg-primary-100") && element.dataset.word) {
            return {
              word: element.dataset.word,
            };
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { word } = node.attrs;

    return [
      "button",
      mergeAttributes({
        type: "button",
        class: FILL_IN_THE_BLANKS_BUTTON_CLASSNAME,
        "data-word": word,
      }),
      `<span>${word}</span><span>${X_ICON_SVG}</span>`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FillInTheBlanksButton);
  },
});
