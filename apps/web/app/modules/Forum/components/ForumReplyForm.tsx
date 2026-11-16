import { FORUM_POST_MAX_LENGTH } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";

import type { FormEvent } from "react";

type ForumReplyFormProps = {
  isSubmitting: boolean;
  onSubmit: (content: string, onSent: () => void) => void;
};

export function ForumReplyForm({ isSubmitting, onSubmit }: ForumReplyFormProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const trimmedContent = content.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedContent) return;

    onSubmit(trimmedContent, () => setContent(""));
  };

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={t("forum.topic.replyPlaceholder")}
        maxLength={FORUM_POST_MAX_LENGTH}
        rows={4}
        aria-label={t("forum.topic.replyPlaceholder")}
        data-testid={FORUM_HANDLES.REPLY_INPUT}
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!trimmedContent || isSubmitting}
          data-testid={FORUM_HANDLES.REPLY_SUBMIT_BUTTON}
        >
          {t("forum.topic.replySubmit")}
        </Button>
      </div>
    </form>
  );
}
