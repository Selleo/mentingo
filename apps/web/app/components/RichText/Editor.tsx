import {
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  RESOURCE_VISIBILITY,
  detectVideoProviderFromUrl,
  type EditableResourceVisibility,
} from "@repo/shared";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { Lock, Unlock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../e2e/data/common/handles";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

import { detectPresentationProvider } from "./extensions/utils/presentation";
import { extractUrlFromClipboard } from "./extensions/utils/video";
import { baseEditorPlugins, boldBulletEditorPlugins, getContentEditorPlugins } from "./plugins";
import { defaultClasses } from "./styles";
import EditorToolbar from "./toolbar/EditorToolbar";

import type { AssetLibraryConfig } from "./components/AssetLibraryDialog";

export const RICH_TEXT_EDITOR_VARIANT = {
  BASE: "base",
  BOLD_BULLET: "bold_bullet",
  CONTENT: "content",
} as const;

type RichTextEditorVariant =
  (typeof RICH_TEXT_EDITOR_VARIANT)[keyof typeof RICH_TEXT_EDITOR_VARIANT];

type EditorProps = {
  content?: string;
  onChange: (value: string) => void;
  onBlur?: (editor: TiptapEditor | null) => void;
  onUpload?: (
    file?: File,
    editor?: TiptapEditor | null,
    visibility?: EditableResourceVisibility,
  ) => Promise<void>;
  onCtrlSave?: (editor: TiptapEditor | null) => void;
  uploadProgress?: number | null;
  placeholder?: string;
  ariaLabel?: string;
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

const getEditorExtensions = (variant: RichTextEditorVariant) => {
  switch (variant) {
    case RICH_TEXT_EDITOR_VARIANT.BASE:
      return baseEditorPlugins;
    case RICH_TEXT_EDITOR_VARIANT.BOLD_BULLET:
      return boldBulletEditorPlugins;
    case RICH_TEXT_EDITOR_VARIANT.CONTENT:
      return getContentEditorPlugins();
  }
};

const Editor = ({
  content,
  placeholder,
  ariaLabel,
  onChange,
  onBlur,
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
  const { t } = useTranslation();
  const editorRef = useRef<TiptapEditor | null>(null);
  const lastEmittedContentRef = useRef(content ?? "");
  const [pendingDrop, setPendingDrop] = useState<{ files: File[]; position: number } | null>(null);
  const [dropVisibility, setDropVisibility] = useState<EditableResourceVisibility>(
    RESOURCE_VISIBILITY.PUBLIC,
  );

  const extensions = useMemo(() => getEditorExtensions(variant), [variant]);

  const uploadDroppedFiles = useCallback(
    async (visibility: EditableResourceVisibility) => {
      if (!pendingDrop || !onUpload) return;

      const activeEditor = editorRef.current;
      setPendingDrop(null);

      for (const file of pendingDrop.files) {
        activeEditor?.commands.setTextSelection(pendingDrop.position);
        activeEditor?.commands.focus();
        await onUpload(file, activeEditor, visibility);
        activeEditor?.commands.focus();
      }
    },
    [onUpload, pendingDrop],
  );

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      const activeEditor = editorRef.current;
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return false;
      if (!allowFiles || !onUpload) return false;

      event.preventDefault();

      const coordinates = activeEditor?.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      setDropVisibility(RESOURCE_VISIBILITY.PUBLIC);
      setPendingDrop({ files, position: coordinates?.pos ?? 0 });
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

      activeEditor
        ?.chain()
        .focus()
        .setVideoEmbed({ src: pastedUrl, sourceType: "external" as const })
        .run();
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
    onBlur: ({ editor }) => onBlur?.(editor),
    onDrop: handleDrop,
    editorProps: {
      handleKeyDown,
      handlePaste: (_view, event) => handlePaste(event),
      attributes: {
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        role: "textbox",
        "aria-multiline": "true",
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
        "prose relative min-w-0 w-full max-w-none overflow-hidden rounded-lg bg-background after:pointer-events-none after:absolute after:inset-0 after:z-[2] after:rounded-lg after:ring-1 after:ring-inset after:ring-neutral-300 after:content-[''] dark:prose-invert [&_.ProseMirror]:leading-tight",
        parentClassName,
      )}
    >
      <EditorToolbar
        editor={editor}
        acceptedFileTypes={acceptedFileTypes}
        assetLibrary={assetLibrary}
        showTableControls={variant === RICH_TEXT_EDITOR_VARIANT.CONTENT}
        limitedFormatting={variant === RICH_TEXT_EDITOR_VARIANT.BOLD_BULLET}
      />
      <EditorContent
        data-testid={RICH_TEXT_HANDLES.CONTENT}
        id={id}
        editor={editor}
        placeholder={placeholder}
        className={editorClasses}
      />
      <Dialog open={Boolean(pendingDrop)} onOpenChange={(open) => !open && setPendingDrop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("richText.dropVisibilityDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("richText.dropVisibilityDialog.description", {
                count: pendingDrop?.files.length ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={dropVisibility}
            onValueChange={(value) => setDropVisibility(value as EditableResourceVisibility)}
            className="flex gap-2 pb-2 pt-4"
          >
            {[RESOURCE_VISIBILITY.PUBLIC, RESOURCE_VISIBILITY.PRIVATE].map((visibility) => (
              <Label
                key={visibility}
                htmlFor={`drop-visibility-${visibility}`}
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  dropVisibility === visibility
                    ? "border border-primary bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] text-primary hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                    : "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <RadioGroupItem
                  id={`drop-visibility-${visibility}`}
                  value={visibility}
                  className="sr-only"
                />
                {visibility === RESOURCE_VISIBILITY.PRIVATE ? (
                  <Lock className="size-4" aria-hidden />
                ) : (
                  <Unlock className="size-4" aria-hidden />
                )}
                {t(`richText.assetLibrary.visibility.${visibility}`)}
              </Label>
            ))}
          </RadioGroup>
          <p className="pb-4 text-sm text-muted-foreground">
            {t("richText.dropVisibilityDialog.privateInfo")}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDrop(null)}>
              {t("common.button.cancel")}
            </Button>
            <Button type="button" onClick={() => void uploadDroppedFiles(dropVisibility)}>
              {t("common.button.proceed")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const BaseEditor = (props: Omit<EditorProps, "variant">) => (
  <Editor {...props} variant={RICH_TEXT_EDITOR_VARIANT.BASE} />
);

export const BoldBulletEditor = (props: Omit<EditorProps, "variant">) => (
  <Editor {...props} variant={RICH_TEXT_EDITOR_VARIANT.BOLD_BULLET} />
);

export const ContentEditor = (props: Omit<EditorProps, "variant">) => (
  <Editor {...props} variant={RICH_TEXT_EDITOR_VARIANT.CONTENT} />
);

export default Editor;
