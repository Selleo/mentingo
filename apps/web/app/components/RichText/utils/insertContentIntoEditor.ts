import { NodeSelection, TextSelection } from "@tiptap/pm/state";

import type { Editor as TiptapEditor } from "@tiptap/react";

export const insertContentIntoEditor = (
  editor: TiptapEditor | null | undefined,
  content: Parameters<TiptapEditor["commands"]["insertContentAt"]>[1],
) => {
  if (!editor) return;

  const { selection } = editor.state;
  const chain = editor.chain().focus();
  if (selection instanceof NodeSelection) {
    chain.insertContentAt(selection.to, content).run();
  } else {
    chain.insertContent(content).run();
  }

  const { state, view } = editor;
  const clampedPos = Math.max(0, Math.min(state.selection.to, state.doc.content.size));
  const nextSelection = TextSelection.near(state.doc.resolve(clampedPos), 1);
  const transaction = state.tr;

  // A document ending in an atomic attachment has no text cursor after it.
  // Selection.near falls back to selecting that attachment, so the next
  // insertContent replaces it. Give subsequent uploads a text position instead.
  if (!(nextSelection instanceof TextSelection)) {
    transaction.insert(clampedPos, state.schema.nodes.paragraph.create());
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(clampedPos + 1), 1));
  } else {
    transaction.setSelection(nextSelection);
  }

  view.dispatch(transaction.scrollIntoView());
};
