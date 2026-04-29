import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

import { COMMENT_CONTENT_MAX } from "./types";

export type CommentComposerHandle = {
  focus: () => void;
};

type Props = {
  onSubmit: (content: string) => Promise<void>;
  isPending: boolean;
  placeholder?: string;
  submitLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  autoFocus?: boolean;
  variant?: "primary" | "reply";
};

export const CommentComposer = forwardRef<CommentComposerHandle, Props>(function CommentComposer(
  {
    onSubmit,
    isPending,
    placeholder,
    submitLabel,
    onCancel,
    cancelLabel,
    autoFocus,
    variant = "primary",
  },
  ref,
) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const trimmed = value.trim();
  const disabled = isPending || trimmed.length === 0 || trimmed.length > COMMENT_CONTENT_MAX;

  const defaultPlaceholder =
    variant === "primary"
      ? t("courseDiscussion.composer.placeholder")
      : t("courseDiscussion.replyComposer.placeholder");

  const defaultSubmit = isPending
    ? t("courseDiscussion.composer.submitting")
    : variant === "primary"
      ? t("courseDiscussion.composer.submit")
      : t("courseDiscussion.replyComposer.submit");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    await onSubmit(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, COMMENT_CONTENT_MAX))}
        placeholder={placeholder ?? defaultPlaceholder}
        rows={variant === "primary" ? 4 : 3}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        disabled={isPending}
        maxLength={COMMENT_CONTENT_MAX}
      />
      <div className="flex items-center justify-between">
        <span className="text-neutral-500 text-xs">
          {value.length}/{COMMENT_CONTENT_MAX}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              {cancelLabel ?? t("courseDiscussion.actions.cancel")}
            </Button>
          )}
          <Button type="submit" disabled={disabled}>
            {isPending && (
              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {submitLabel ?? defaultSubmit}
          </Button>
        </div>
      </div>
    </form>
  );
});
