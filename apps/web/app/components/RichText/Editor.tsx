import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useLessonFileUpload } from "~/api/mutations/admin/useLessonFileUpload";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { LessonTypes } from "~/modules/Courses/CourseView/lessonTypes";

import { plugins } from "./plugins";
import { defaultClasses } from "./styles";
import EditorToolbar from "./toolbar/EditorToolbar";

type EditorProps = {
  content?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  parentClassName?: string;
  lessonType?: string;
  lessonId?: string;
};

const Editor = ({
  content,
  placeholder,
  onChange,
  id,
  className,
  parentClassName,
  lessonType,
  lessonId,
}: EditorProps) => {
  const { mutateAsync: uploadFile } = useLessonFileUpload();

  const { toast } = useToast();
  const { t } = useTranslation();

  const handleFileInsert = async (
    e: DragEvent | ClipboardEvent,
    file?: File,
    editor?: TiptapEditor | null,
  ) => {
    if (!file || !lessonId || lessonType != LessonTypes.text) {
      return toast({ title: t("richTextEditor.toolbar.upload.uploadFailed") });
    }

    if (ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(file.type)) {
      e.preventDefault();

      const uploaded = await uploadFile({ file, lessonId });

      const imageUrl = `${import.meta.env.VITE_APP_URL}/api/lesson/lesson-image/${uploaded}`;

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

  const editorClasses = cn("h-full", defaultClasses.ul, defaultClasses.ol, defaultClasses.taskList);

  return (
    <div
      className={cn(
        "prose w-full max-w-none overflow-hidden rounded-lg border border-neutral-300 bg-background dark:prose-invert [&_.ProseMirror]:leading-tight",
        parentClassName,
      )}
    >
      <EditorToolbar
        editor={editor}
        allowFiles={lessonType === LessonTypes.text}
        lessonId={lessonId}
      />
      <div
        className={cn(
          "relative h-[200px] max-h-[600px] min-h-[200px] resize-y overflow-auto [&_.ProseMirror]:h-full [&_.ProseMirror]:max-h-full [&_.ProseMirror]:min-h-full",
          className,
        )}
      >
        <EditorContent
          id={id}
          editor={editor}
          placeholder={placeholder}
          className={editorClasses}
        />
      </div>
    </div>
  );
};

export default Editor;
