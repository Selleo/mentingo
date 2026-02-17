import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { cn } from "~/lib/utils";

import { viewerPlugins } from "./plugins";
import {
  newsVariantClasses,
  articleVariantClasses,
  defaultClasses,
  contentVariantClasses,
} from "./styles";
import {
  resolveRichTextVideoAutoplay,
  type RichTextVideoAutoplayPolicy,
} from "./videoAutoplayPolicy";

import type { VideoAutoplay } from "@repo/shared";

type ViewerProps = {
  content: string;
  style?: "default" | "prose";
  className?: string;
  variant?: "default" | "article" | "news" | "content";
  onVideoEnded?: () => void;
  videoAutoplayPolicy?: RichTextVideoAutoplayPolicy;
};

const Viewer = ({
  content,
  style,
  className,
  variant = "default",
  onVideoEnded,
  videoAutoplayPolicy = "inherit",
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

  const onVideoEndedRef = useRef<(() => void) | undefined>();

  useEffect(() => {
    onVideoEndedRef.current = onVideoEnded;
  }, [onVideoEnded]);

  const handleVideoEnded = useCallback(() => {
    onVideoEndedRef.current?.();
  }, []);

  const extensions = useMemo(
    () =>
      viewerPlugins.map((extension) =>
        extension.name === "video"
          ? extension.configure({
              onVideoEnded: handleVideoEnded,
              resolveAutoplay: (autoplay: VideoAutoplay) =>
                resolveRichTextVideoAutoplay(autoplay, videoAutoplayPolicy),
            })
          : extension,
      ),
    [handleVideoEnded, videoAutoplayPolicy],
  );

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

export default Viewer;
