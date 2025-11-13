import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { useEffect } from "react";

import { useLessonFileUpload } from "~/api/mutations/admin/useLessonFileUpload";
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

  const handleFileInsert = async (
    file: File,
    editor: TiptapEditor | null,
    e: DragEvent | ClipboardEvent,
  ) => {
    if (!file || !lessonId || lessonType != LessonTypes.text) {
      return;
    }

    if (file.type.startsWith("image/")) {
      const uploaded = await uploadFile({ file, lessonId });

      const url = `${import.meta.env.VITE_APP_URL}/api/lesson/lesson-image/${uploaded}`;

      editor?.chain().insertContent(`<a href="${url}">${url}</a>`).run();

      e.preventDefault?.();
    }
  };

  const editor = useEditor({
    extensions: [...plugins],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onPaste: async (e) => {
      const file = e.clipboardData?.files[0];

      if (!file) return;

      await handleFileInsert(file, editor, e);
    },
    onDrop: async (e) => {
      const file = e.dataTransfer?.files[0];

      if (!file) return;

      await handleFileInsert(file, editor, e);
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
