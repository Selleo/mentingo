import { EditorContent, useEditor } from "@tiptap/react";

import { cn } from "../../lib/utils";

import { plugins } from "./plugins";
import { defaultClasses, lessonVariantClasses } from "./styles";

type ViewerProps = {
  content: string;
  style?: "default" | "prose";
  className?: string;
  variant?: "default" | "lesson";
};

const Viewer = ({ content, style, className, variant = "default" }: ViewerProps) => {
  const classNames = cn(
    {
      "prose max-w-none dark:prose-invert prose": style === "prose",
    },
    className,
  );

  const variantClasses =
    variant === "lesson"
      ? [
          lessonVariantClasses.h2,
          lessonVariantClasses.p,
          lessonVariantClasses.layout,
          lessonVariantClasses.ol,
          lessonVariantClasses.ul,
        ]
      : [];

  const editorClasses = cn(
    "h-full flex ",
    defaultClasses.ul,
    defaultClasses.ol,
    defaultClasses.taskList,
    ...variantClasses,
  );

  const editor = useEditor(
    {
      extensions: [...plugins],
      content: content,
      editable: false,
      editorProps: {
        attributes: {
          class: cn({ "prose max-w-none dark:prose-invert": variant === "lesson" }),
        },
      },
    },
    [content],
  );

  if (!editor) return <></>;

  return (
    <article className={classNames}>
      <EditorContent editor={editor} readOnly={true} className={editorClasses} />
    </article>
  );
};

export default Viewer;
