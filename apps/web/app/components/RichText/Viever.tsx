import { EditorContent, useEditor } from "@tiptap/react";

import { cn } from "../../lib/utils";

import { plugins } from "./plugins";
import { defaultClasses, lessonVariantClasses, newsVariantClasses } from "./styles";

type ViewerProps = {
  content: string;
  style?: "default" | "prose";
  className?: string;
  variant?: "default" | "lesson" | "news";
};

const Viewer = ({ content, style, className, variant = "default" }: ViewerProps) => {
  const variantStyles = {
    default: {
      wrapper: "",
      editor: [],
      content: "",
    },
    lesson: {
      wrapper: "",
      editor: [
        lessonVariantClasses.h2,
        lessonVariantClasses.p,
        lessonVariantClasses.layout,
        lessonVariantClasses.ol,
        lessonVariantClasses.ul,
      ],
      content: "prose max-w-none dark:prose-invert",
    },
    news: {
      wrapper: newsVariantClasses.wrapper,
      editor: [newsVariantClasses.layout],
      content: ["prose prose-neutral max-w-none", newsVariantClasses.links].join(" "),
    },
  } as const;

  const selectedVariant = variantStyles[variant] ?? variantStyles.default;

  const classNames = cn(
    {
      "prose max-w-none dark:prose-invert prose": style === "prose",
    },
    selectedVariant.wrapper,
    className,
  );

  const editorClasses = cn(
    "h-full flex flex-col",
    defaultClasses.ul,
    defaultClasses.ol,
    defaultClasses.taskList,
    selectedVariant.editor,
  );

  const editor = useEditor(
    {
      extensions: [...plugins],
      content: content,
      editable: false,
      editorProps: {
        attributes: {
          class: cn(selectedVariant.content),
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
