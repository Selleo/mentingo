import { TextSelection } from "@tiptap/pm/state";

import type { Editor as TiptapEditor } from "@tiptap/react";

export const insertContentIntoEditor = (
  editor: TiptapEditor | null | undefined,
  content: Parameters<TiptapEditor["commands"]["insertContentAt"]>[1],
) => {
  if (!editor) return;

  editor.chain().focus().insertContent(content).run();

  const { state, view } = editor;
  const clampedPos = Math.max(0, Math.min(state.selection.to, state.doc.content.size));
  const nextSelection = TextSelection.near(state.doc.resolve(clampedPos), 1);

  view.dispatch(state.tr.setSelection(nextSelection).scrollIntoView());
};
