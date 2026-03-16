import { Document } from "@tiptap/extension-document";
import { Link } from "@tiptap/extension-link";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Text } from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { InsertLinkDialog } from "./components/InsertLinkDialog";

type LinkOnlyEditorProps = {
  content?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  enableLinkClick?: boolean;
};

export function LinkOnlyEditor({
  content,
  onChange,
  placeholder,
  className,
  enableLinkClick = false,
}: LinkOnlyEditorProps) {
  const { t } = useTranslation();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Link.configure({
        openOnClick: enableLinkClick,
        HTMLAttributes: {
          class: "text-primary-700 underline cursor-pointer",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? t("registrationFormBuilder.field.labelPlaceholder"),
      }),
    ],
    content,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] max-w-full p-4 focus:outline-none prose prose-sm max-w-none [&_p]:my-0 [&_a]:cursor-pointer [&_a]:pointer-events-auto",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-neutral-300 bg-background",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-neutral-200 py-2 px-4">
        <span className="text-xs text-neutral-500">
          {t("registrationFormBuilder.field.linkOnlyHint")}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn({
            "border-primary bg-primary/5": editor.isActive("link"),
          })}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
              return;
            }

            setIsLinkDialogOpen(true);
          }}
        >
          <Link2 className="mr-2 size-4" />
          {t("registrationFormBuilder.field.addLink")}
        </Button>
      </div>
      <EditorContent editor={editor} />
      <InsertLinkDialog
        editor={editor}
        open={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
      />
    </div>
  );
}
