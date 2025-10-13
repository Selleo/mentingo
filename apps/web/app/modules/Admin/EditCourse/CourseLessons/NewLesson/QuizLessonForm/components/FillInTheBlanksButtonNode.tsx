import { Node, NodeViewWrapper, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react";

import { StringifiedIcons } from "~/utils/stringifiedIcons";

import { FILL_IN_THE_BLANKS_BUTTON_CLASSNAME } from "./constants";

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
      <span className="cursor-pointer" dangerouslySetInnerHTML={{ __html: StringifiedIcons.X }} />
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
      `<span>${word}</span><span>${StringifiedIcons.X}</span>`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FillInTheBlanksButton);
  },
});
