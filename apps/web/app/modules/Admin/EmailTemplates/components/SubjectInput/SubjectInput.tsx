import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Text } from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";

import { VariableHighlightExtension } from "../../tiptap/variable-highlight";

const SingleLineDocument = Document.extend({ content: "paragraph" });

const buildContent = (v: string) =>
  v
    ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: v }] }] }
    : { type: "doc", content: [{ type: "paragraph" }] };

type SubjectInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  testId?: string;
};

export const SubjectInput = ({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  testId,
}: SubjectInputProps) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor(
    {
      extensions: [
        SingleLineDocument,
        Paragraph,
        Text,
        VariableHighlightExtension,
        Placeholder.configure({ placeholder: placeholder ?? "" }),
      ],
      content: buildContent(value),
      editorProps: {
        attributes: {
          class: "email-subject-input block w-full text-sm text-neutral-900 focus:outline-none",
          ...(id ? { id } : {}),
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        },
        handleKeyDown: (_view, event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: e }) => {
        onChangeRef.current(e.getText());
      },
    },
    [placeholder],
  );

  useEffect(() => {
    if (!editor) return;
    if (editor.getText() === value) return;
    editor.commands.setContent(buildContent(value), false);
  }, [editor, value]);

  return (
    <div data-testid={testId} className="[&_.ProseMirror]:min-h-[1.25rem] [&_p]:m-0">
      <EditorContent editor={editor} />
    </div>
  );
};
