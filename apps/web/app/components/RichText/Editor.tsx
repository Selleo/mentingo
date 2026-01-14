import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

import { detectPresentationProvider } from "./extensions/utils/presentation";
import { detectVideoProvider, extractUrlFromClipboard } from "./extensions/utils/video";
import { baseEditorPlugins, lessonEditorPlugins } from "./plugins";
import { defaultClasses } from "./styles";
import EditorToolbar from "./toolbar/EditorToolbar";

type EditorProps = {
  content?: string;
  onChange: (value: string) => void;
  onUpload?: (file?: File, editor?: TiptapEditor | null) => Promise<void>;
  onCtrlSave?: (editor: TiptapEditor | null) => void;
  uploadProgress?: number | null;
  placeholder?: string;
  id?: string;
  parentClassName?: string;
  lessonId?: string;
  allowFiles?: boolean;
  acceptedFileTypes?: string[];
  variant?: "base" | "lesson";
};

const Editor = ({
  content,
  placeholder,
  onChange,
  onUpload,
  onCtrlSave,
  uploadProgress,
  id,
  parentClassName,
  lessonId,
  allowFiles = false,
  acceptedFileTypes = ALLOWED_LESSON_IMAGE_FILE_TYPES,
  variant = "lesson",
}: EditorProps) => {
  const editorRef = useRef<TiptapEditor | null>(null);

  const extensions = useMemo(
    () => (variant === "base" ? baseEditorPlugins : lessonEditorPlugins),
    [variant],
  );

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      const activeEditor = editorRef.current;
      const file = event.dataTransfer?.files[0];
      if (!file) return false;

      event.preventDefault();
      await onUpload?.(file, activeEditor);
      return true;
    },
    [onUpload],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const activeEditor = editorRef.current;
      const file = event.clipboardData?.files[0];

      if (file) {
        event.preventDefault();
        void onUpload?.(file, activeEditor);
        return true;
      }

      const pastedUrl = extractUrlFromClipboard(event);
      if (!pastedUrl) return false;

      const videoProvider = detectVideoProvider(pastedUrl);
      const presentationProvider = detectPresentationProvider(pastedUrl);

      if (videoProvider === "unknown" && presentationProvider === "unknown") {
        return false;
      }

      if (presentationProvider !== "unknown") {
        activeEditor
          ?.chain()
          .focus()
          .setPresentationEmbed({ src: pastedUrl, sourceType: "external" })
          .run();
        return true;
      }

      activeEditor?.chain().focus().setVideoEmbed({ src: pastedUrl, sourceType: "external" }).run();
      return true;
    },
    [onUpload],
  );

  const handleKeyDown = useCallback(
    (_view: unknown, event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onCtrlSave?.(editorRef.current);
        return true;
      }
      return false;
    },
    [onCtrlSave],
  );

  const editor = useEditor({
    extensions,
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onDrop: handleDrop,
    editorProps: {
      handleKeyDown,
      handlePaste: (_view, event) => handlePaste(event),
      attributes: {
        class: "prose prose-xs sm:prose dark:prose-invert focus:outline-none max-w-full p-4",
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

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
      {uploadProgress && (
        <div className="border-t border-neutral-200 relative">
          <Progress value={uploadProgress} className="h-3 rounded-none" />
        </div>
      )}
      <EditorContent id={id} editor={editor} placeholder={placeholder} className={editorClasses} />
    </div>
  );
};

export const BaseEditor = (props: Omit<EditorProps, "variant">) => (
  <Editor {...props} variant="base" />
);

export const LessonEditor = (props: Omit<EditorProps, "variant">) => (
  <Editor {...props} variant="lesson" />
);

export default Editor;
