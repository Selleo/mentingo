import { ALLOWED_LESSON_IMAGE_FILE_TYPES, detectVideoProviderFromUrl } from "@repo/shared";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../e2e/data/common/handles";

import { detectPresentationProvider } from "./extensions/utils/presentation";
import { extractUrlFromClipboard } from "./extensions/utils/video";
import { baseEditorPlugins, getContentEditorPlugins } from "./plugins";
import { defaultClasses } from "./styles";
import EditorToolbar from "./toolbar/EditorToolbar";

import type { AssetLibraryConfig } from "./components/AssetLibraryDialog";

export const RICH_TEXT_EDITOR_VARIANT = {
  BASE: "base",
  CONTENT: "content",
} as const;

type RichTextEditorVariant =
  (typeof RICH_TEXT_EDITOR_VARIANT)[keyof typeof RICH_TEXT_EDITOR_VARIANT];

type EditorProps = {
  content?: string;
  onChange: (value: string) => void;
  onUpload?: (file?: File, editor?: TiptapEditor | null) => Promise<void>;
  onCtrlSave?: (editor: TiptapEditor | null) => void;
  uploadProgress?: number | null;
  placeholder?: string;
  id?: string;
  parentClassName?: string;
  contentClassName?: string;
  editorClassName?: string;
  lessonId?: string;
  allowFiles?: boolean;
  acceptedFileTypes?: readonly string[];
  assetLibrary?: AssetLibraryConfig;
  variant?: RichTextEditorVariant;
};

const EMPTY_EDITOR_MIN_HEIGHT_CLASS = "min-h-[240px]";

const Editor = ({
  content,
  placeholder,
  onChange,
  onUpload,
  onCtrlSave,
  id,
  parentClassName,
  contentClassName,
  editorClassName,
  allowFiles = false,
  acceptedFileTypes = ALLOWED_LESSON_IMAGE_FILE_TYPES,
  assetLibrary,
  variant = RICH_TEXT_EDITOR_VARIANT.CONTENT,
}: EditorProps) => {
  const editorRef = useRef<TiptapEditor | null>(null);
  const lastEmittedContentRef = useRef(content ?? "");

  const extensions = useMemo(
    () =>
      variant === RICH_TEXT_EDITOR_VARIANT.BASE ? baseEditorPlugins : getContentEditorPlugins(),
    [variant],
  );

  const handleDrop = useCallback(
    (event: DragEvent) => {
      const activeEditor = editorRef.current;
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return false;
      if (!allowFiles || !onUpload) return false;

      event.preventDefault();
      void Promise.allSettled(files.map((file) => onUpload(file, activeEditor)));
      return true;
    },
    [allowFiles, onUpload],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const activeEditor = editorRef.current;
      const file = event.clipboardData?.files[0];

      if (file) {
        if (!allowFiles || !onUpload) return false;

        event.preventDefault();
        void onUpload(file, activeEditor);
        return true;
      }

      const pastedUrl = extractUrlFromClipboard(event);
      if (!pastedUrl) return false;

      const videoProvider = detectVideoProviderFromUrl(pastedUrl);
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
    [allowFiles, onUpload],
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
      const nextContent = editor.getHTML();
      lastEmittedContentRef.current = nextContent;
      onChange(nextContent);
    },
    onDrop: handleDrop,
    editorProps: {
      handleKeyDown,
      handlePaste: (_view, event) => handlePaste(event),
      attributes: {
        class: cn(
          "prose prose-xs sm:prose dark:prose-invert focus:outline-none max-w-full p-4 !max-w-full",
          EMPTY_EDITOR_MIN_HEIGHT_CLASS,
          editorClassName,
        ),
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (
      editor &&
      content !== undefined &&
      content !== editor.getHTML() &&
      content !== lastEmittedContentRef.current
    ) {
      editor.commands.setContent(content || "");
      lastEmittedContentRef.current = content || "";
    }
  }, [content, editor]);

  if (!editor) return <></>;

  const editorClasses = cn(
    "h-full",
    EMPTY_EDITOR_MIN_HEIGHT_CLASS,
    defaultClasses.ul,
    defaultClasses.ol,
    defaultClasses.taskList,
    contentClassName,
  );

  return (
    <div
      data-testid={RICH_TEXT_HANDLES.ROOT}
      className={cn(
        "prose w-full max-w-none overflow-hidden rounded-lg border border-neutral-300 bg-background dark:prose-invert [&_.ProseMirror]:leading-tight",
        parentClassName,
      )}
    >
      <EditorToolbar
        editor={editor}
        acceptedFileTypes={acceptedFileTypes}
        assetLibrary={assetLibrary}
        showTableControls={variant === RICH_TEXT_EDITOR_VARIANT.CONTENT}
      />
      <EditorContent
        data-testid={RICH_TEXT_HANDLES.CONTENT}
        id={id}
        editor={editor}
        placeholder={placeholder}
        className={editorClasses}
      />
    </div>
  );
};

export const BaseEditor = (props: Omit<EditorProps, "variant">) => (
  <Editor {...props} variant={RICH_TEXT_EDITOR_VARIANT.BASE} />
);

export const ContentEditor = (props: Omit<EditorProps, "variant">) => (
  <Editor {...props} variant={RICH_TEXT_EDITOR_VARIANT.CONTENT} />
);

export default Editor;
