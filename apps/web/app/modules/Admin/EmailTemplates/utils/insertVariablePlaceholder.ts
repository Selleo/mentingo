import { TextSelection } from "@tiptap/pm/state";

import type { CommandProps } from "@maily-to/core/blocks";

export const insertVariablePlaceholder =
  () =>
  ({ editor, range }: CommandProps) =>
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent("{{}}")
      .command(({ tr }) => {
        tr.setSelection(TextSelection.create(tr.doc, tr.selection.from - 2));
        return true;
      })
      .run();
