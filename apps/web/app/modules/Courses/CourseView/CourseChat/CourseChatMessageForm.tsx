import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "~/components/ui/button";

import { MentionTextarea } from "./MentionTextarea";

import type { KeyboardEvent } from "react";
import type { CourseChatUser } from "~/api/queries/course-chat/courseChatTypes";

const courseChatMessageFormSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

type CourseChatMessageFormValues = z.infer<typeof courseChatMessageFormSchema>;

type CourseChatMessageFormProps = {
  users: CourseChatUser[];
  placeholder: string;
  isSubmitting: boolean;
  onSubmit: (content: string, options: { onSuccess: () => void }) => void;
  formClassName?: string;
  wrapperClassName?: string;
  textareaClassName?: string;
  autoFocus?: boolean;
};

export function CourseChatMessageForm({
  users,
  placeholder,
  isSubmitting,
  onSubmit,
  formClassName,
  wrapperClassName,
  textareaClassName,
  autoFocus,
}: CourseChatMessageFormProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const form = useForm<CourseChatMessageFormValues>({
    resolver: zodResolver(courseChatMessageFormSchema),
    defaultValues: { content: "" },
  });
  const content = form.watch("content");

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = form.handleSubmit(async (values) => {
    onSubmit(values.content, { onSuccess: () => form.reset() });
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form className={formClassName} onSubmit={handleSubmit}>
      <div className={wrapperClassName}>
        <Controller
          control={form.control}
          name="content"
          render={({ field }) => (
            <MentionTextarea
              ref={textareaRef}
              value={field.value}
              onChange={field.onChange}
              onKeyDown={handleKeyDown}
              users={users}
              placeholder={placeholder}
              maxLength={5000}
              className={textareaClassName}
            />
          )}
        />
        <Button
          type="submit"
          size="xs"
          className="size-8 self-end rounded-lg p-0"
          aria-label={t("studentCourseView.courseChat.send")}
          disabled={!content.trim() || isSubmitting}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </form>
  );
}
