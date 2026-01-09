import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { useEffect } from "react";

import { cn } from "~/lib/utils";
import { baseUrl } from "~/utils/baseUrl";

import { detectVideoProvider, extractUrlFromClipboard } from "./extensions/utils/video";
import { editorPlugins } from "./plugins";
import { defaultClasses } from "./styles";
import EditorToolbar from "./toolbar/EditorToolbar";

type EditorProps = {
  content?: string;
  onChange: (value: string) => void;
  onUpload?: (file?: File, editor?: TiptapEditor | null) => Promise<void>;
  placeholder?: string;
  id?: string;
  parentClassName?: string;
  lessonId?: string;
  allowFiles?: boolean;
  acceptedFileTypes?: string[];
};

const Editor = ({
  content,
  placeholder,
  onChange,
  onUpload,
  id,
  parentClassName,
  lessonId,
  allowFiles = false,
  acceptedFileTypes = ALLOWED_LESSON_IMAGE_FILE_TYPES,
}: EditorProps) => {
  const editor = useEditor({
    extensions: [...editorPlugins],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onDrop: async (e) => {
      const file = e.dataTransfer?.files[0];
      if (!file) return false;

      e.preventDefault();
      await onUpload?.(file, editor);
      return true;
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const file = event.clipboardData?.files[0];

        if (file) {
          event.preventDefault();
          void onUpload?.(file, editor);
          return true;
        }

        const pastedUrl = extractUrlFromClipboard(event);
        if (!pastedUrl) return false;

        const isInternal = pastedUrl.startsWith(baseUrl);
        const provider = detectVideoProvider(pastedUrl);

        if (!isInternal && provider === "unknown") return false;

        editor
          ?.chain()
          .focus()
          .setVideoEmbed({ src: pastedUrl, sourceType: isInternal ? "internal" : "external" })
          .run();
        return true;
      },
      attributes: {
        class: "prose prose-xs sm:prose dark:prose-invert focus:outline-none max-w-full p-4",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  if (!editor) return <></>;

  const editorClasses = cn(
    "h-full min-h-[200px]",
    defaultClasses.ul,
    defaultClasses.ol,
    defaultClasses.taskList,
  );

  return (
    <div
      className={cn(
        "prose w-full max-w-none overflow-hidden rounded-lg border border-neutral-300 bg-background dark:prose-invert [&_.ProseMirror]:leading-tight",
        parentClassName,
      )}
    >
      <EditorToolbar
        editor={editor}
        allowFiles={allowFiles}
        lessonId={lessonId}
        acceptedFileTypes={acceptedFileTypes}
        onUpload={onUpload}
      />
      <EditorContent id={id} editor={editor} placeholder={placeholder} className={editorClasses} />
    </div>
  );
};

export default Editor;
