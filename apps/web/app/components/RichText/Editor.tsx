import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useLessonFileUpload } from "../../api/mutations/admin/useLessonFileUpload";
import { cn } from "../../lib/utils";
import { baseUrl } from "../../utils/baseUrl";
import { useToast } from "../ui/use-toast";

import { plugins } from "./plugins";
import { defaultClasses } from "./styles";
import EditorToolbar from "./toolbar/EditorToolbar";

type EditorProps = {
  content?: string;
  onChange: (value: string) => void;
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
  id,
  parentClassName,
  lessonId,
  allowFiles = false,
  acceptedFileTypes = ALLOWED_LESSON_IMAGE_FILE_TYPES,
}: EditorProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { mutateAsync: uploadFile } = useLessonFileUpload();

  const handleFileInsert = async (
    e: DragEvent | ClipboardEvent,
    file?: File,
    editor?: TiptapEditor | null,
  ) => {
    if (!file || !lessonId) return;

    e.preventDefault();

    if (!allowFiles) {
      return toast({ title: t("richTextEditor.toolbar.upload.uploadFailed") });
    }

    if (acceptedFileTypes.includes(file.type)) {
      const uploaded = await uploadFile({ file, lessonId });

      const imageUrl = `${baseUrl}/api/lesson/lesson-image/${uploaded}`;

      editor?.chain().insertContent(`<a href="${imageUrl}">${imageUrl}</a>`).run();
    }
  };

  const editor = useEditor({
    extensions: [...plugins],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onPaste: async (e) => {
      if (!lessonId) return;

      const file = e.clipboardData?.files[0];

      await handleFileInsert(e, file, editor);
    },
    onDrop: async (e) => {
      if (!lessonId) return;

      const file = e.dataTransfer?.files[0];

      await handleFileInsert(e, file, editor);
    },
    editorProps: {
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
      />
      <EditorContent id={id} editor={editor} placeholder={placeholder} className={editorClasses} />
    </div>
  );
};

export default Editor;
