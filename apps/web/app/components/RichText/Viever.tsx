import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { cn } from "~/lib/utils";

import { baseViewerPlugins, contentViewerPlugins } from "./plugins";
import {
  newsVariantClasses,
  articleVariantClasses,
  defaultClasses,
  contentVariantClasses,
} from "./styles";

type ViewerProps = {
  content: string;
  style?: "default" | "prose";
  className?: string;
  variant?: RichTextViewerVariant;
  onVideoEnded?: (index: number | null) => void;
};

export const RICH_TEXT_VIEWER_VARIANT = {
  DEFAULT: "default",
  ARTICLE: "article",
  NEWS: "news",
  CONTENT: "content",
} as const;

type RichTextViewerVariant =
  (typeof RICH_TEXT_VIEWER_VARIANT)[keyof typeof RICH_TEXT_VIEWER_VARIANT];

const Viewer = ({
  content,
  style,
  className,
  variant = RICH_TEXT_VIEWER_VARIANT.DEFAULT,
  onVideoEnded,
}: ViewerProps) => {
  const variantStyles = {
    default: {
      wrapper: "",
      editor: [],
      content: "",
    },
    article: {
      wrapper: articleVariantClasses.wrapper,
      editor: [articleVariantClasses.layout],
      content: ["prose prose-neutral max-w-none", articleVariantClasses.links].join(" "),
    },
    news: {
      wrapper: newsVariantClasses.wrapper,
      editor: [newsVariantClasses.layout],
      content: ["prose prose-neutral max-w-none", newsVariantClasses.links].join(" "),
    },
    content: {
      wrapper: contentVariantClasses.wrapper,
      editor: [contentVariantClasses.layout],
      content: ["prose prose-neutral max-w-none", contentVariantClasses.links].join(" "),
    },
  } as const;

  const selectedVariant = variantStyles[variant] ?? variantStyles.default;
  const onVideoEndedRef = useRef<typeof onVideoEnded>();

  useEffect(() => {
    onVideoEndedRef.current = onVideoEnded;
  }, [onVideoEnded]);

  const handleVideoEnded = useCallback((index: number | null) => {
    onVideoEndedRef.current?.(index);
  }, []);

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

  const extensions = useMemo(() => {
    const plugins =
      variant === RICH_TEXT_VIEWER_VARIANT.DEFAULT ? baseViewerPlugins : contentViewerPlugins;

    return plugins.map((extension) =>
      extension.name === "video" && variant === RICH_TEXT_VIEWER_VARIANT.CONTENT
        ? extension.configure({ onVideoEnded: handleVideoEnded })
        : extension,
    );
  }, [handleVideoEnded, variant]);

  const editor = useEditor(
    {
      extensions,
      content,
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

export const ContentViewer = (props: Omit<ViewerProps, "variant">) => (
  <Viewer {...props} variant={RICH_TEXT_VIEWER_VARIANT.CONTENT} />
);

export default Viewer;
