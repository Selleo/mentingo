import { forwardRef, useLayoutEffect, useRef } from "react";

import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

import type { ForwardedRef } from "react";
import type { TextareaProps } from "~/components/ui/textarea";

export type AutosizeTextareaProps = TextareaProps & {
  maxRows?: number;
};

const setForwardedRef = (
  forwardedRef: ForwardedRef<HTMLTextAreaElement>,
  element: HTMLTextAreaElement | null,
) => {
  if (typeof forwardedRef === "function") {
    forwardedRef(element);
    return;
  }

  if (forwardedRef) forwardedRef.current = element;
};

export const AutosizeTextarea = forwardRef<HTMLTextAreaElement, AutosizeTextareaProps>(
  ({ className, maxRows = 5, onInput, value, ...props }, forwardedRef) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const resize = () => {
      const element = textareaRef.current;
      if (!element) return;

      const styles = window.getComputedStyle(element);
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const verticalChrome =
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom) +
        Number.parseFloat(styles.borderTopWidth) +
        Number.parseFloat(styles.borderBottomWidth);
      const maxHeight = lineHeight * maxRows + verticalChrome;

      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
      element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    useLayoutEffect(resize, [maxRows, value]);

    return (
      <Textarea
        {...props}
        ref={(element) => {
          textareaRef.current = element;
          setForwardedRef(forwardedRef, element);
        }}
        value={value}
        rows={2}
        className={cn("min-h-[2.75rem] resize-none overflow-y-hidden", className)}
        onInput={(event) => {
          resize();
          onInput?.(event);
        }}
      />
    );
  },
);

AutosizeTextarea.displayName = "AutosizeTextarea";
