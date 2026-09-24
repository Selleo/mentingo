import { Link } from "@tiptap/extension-link";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Bold, Check, Italic, Link2, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE } from "../emailTemplates.constants";
import { serializeEmailTemplateParagraphs } from "../emailTemplates.utils";
import { getEmailTemplateVariableRanges } from "../emailTemplateVariableHighlight.utils";

import { EmailTemplateTextField } from "./EmailTemplateTextField";

import type {
  EmailTemplateVariableInserter,
  EmailTemplateParagraph,
  EmailTemplateVariables,
} from "../emailTemplates.types";

export type EmailTemplateRichTextProps = {
  content: EmailTemplateParagraph[];
  variables: EmailTemplateVariables;
  onChange: (content: EmailTemplateParagraph[]) => void;
  disabled: boolean;
  inline?: boolean;
  onRegisterVariableInserter?: (insert: EmailTemplateVariableInserter) => void;
};

export function EmailTemplateRichText({
  content,
  variables,
  onChange,
  disabled,
  inline = false,
  onRegisterVariableInserter,
}: EmailTemplateRichTextProps) {
  const { t } = useTranslation();
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    autofocus: inline && !disabled ? "end" : false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        isAllowedUri: (uri) => uri.startsWith("https://") || /^{{\s*[a-zA-Z0-9_]+\s*}}$/.test(uri),
      }),
    ],
    content: { type: "doc", content },
    onUpdate: ({ editor: current }) =>
      onChange(serializeEmailTemplateParagraphs(current.getJSON())),
    editorProps: {
      decorations: (state) => {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, position) => {
          if (!node.isTextblock) return;
          for (const range of getEmailTemplateVariableRanges(node.textContent, variables)) {
            decorations.push(
              Decoration.inline(position + 1 + range.from, position + 1 + range.to, {
                class: "text-primary-700",
              }),
            );
          }
          return false;
        });
        return DecorationSet.create(state.doc, decorations);
      },
      handleDrop: (view, event) => {
        const variableKey = event.dataTransfer?.getData(EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE);
        if (!variableKey) return false;
        event.preventDefault();
        if (disabled || !variables.some((variable) => variable.key === variableKey)) return true;
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!position) return true;
        view.dispatch(view.state.tr.insertText(`{{ ${variableKey} }}`, position.pos));
        view.focus();
        return true;
      },
      attributes: {
        role: "textbox",
        "aria-label": t("emailTemplates.ui.richText"),
        class: cn("outline-none max-w-none [&_p]:my-2 [&_a]:text-primary-700 [&_a]:underline", {
          "min-h-28 p-4 prose prose-sm": !inline,
          "flow-root [&_p]:whitespace-pre-wrap": inline,
        }),
      },
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    if (!editor || !onRegisterVariableInserter) return;
    onRegisterVariableInserter((token) =>
      editor.chain().focus().insertContent({ type: "text", text: token }).run(),
    );
    return () => onRegisterVariableInserter(null);
  }, [editor, onRegisterVariableInserter]);
  useEffect(() => {
    if (
      editor &&
      JSON.stringify(serializeEmailTemplateParagraphs(editor.getJSON())) !== JSON.stringify(content)
    )
      editor.commands.setContent({ type: "doc", content }, false);
  }, [content, editor]);
  return (
    <div className={cn("bg-white", { "rounded-lg border border-neutral-300": !inline })}>
      <div
        className={cn("flex items-center text-sm text-neutral-900", {
          "flex-wrap gap-1 border-b p-2": !inline,
          "absolute top-0 left-1 z-20 -translate-y-1/2 rounded-md border bg-white p-0.5 shadow-sm [&>button]:size-7 [&_svg]:size-3.5":
            inline,
        })}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={t("emailTemplates.ui.bold")}
          aria-pressed={editor?.isActive("bold") ?? false}
          className={cn({ "bg-neutral-100": editor?.isActive("bold") })}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={t("emailTemplates.ui.italic")}
          aria-pressed={editor?.isActive("italic") ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={t(
            editor?.isActive("link") ? "emailTemplates.ui.unlink" : "emailTemplates.ui.link",
          )}
          aria-pressed={editor?.isActive("link") ?? false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (editor?.isActive("link")) {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              setIsLinkEditorOpen(false);
              return;
            }
            setLinkUrl(editor?.getAttributes("link").href ?? "");
            setIsLinkEditorOpen(!isLinkEditorOpen);
          }}
        >
          {editor?.isActive("link") ? <Unlink className="size-4" /> : <Link2 className="size-4" />}
        </Button>
      </div>
      {isLinkEditorOpen && (
        <div
          className={cn("flex items-center gap-2 p-2", {
            "border-b": !inline,
            "absolute left-1 top-6 z-30 w-64 max-w-[calc(100%-0.5rem)] rounded-md border bg-white shadow-sm":
              inline,
          })}
        >
          <EmailTemplateTextField
            compact
            label={t("emailTemplates.ui.url")}
            highlightVariables
            value={linkUrl}
            onChange={setLinkUrl}
            variables={variables}
            disabled={disabled}
          />
          <Button
            type="button"
            size="sm"
            className="size-8 shrink-0 p-0"
            aria-label={t("emailTemplates.ui.applyLink")}
            title={t("emailTemplates.ui.applyLink")}
            disabled={disabled || !linkUrl.trim()}
            onClick={() => {
              editor?.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
              setIsLinkEditorOpen(false);
            }}
          >
            <Check className="size-4" />
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
