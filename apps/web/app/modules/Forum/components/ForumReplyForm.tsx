import { FORUM_POST_MAX_LENGTH } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { MentionTextarea } from "~/modules/Courses/CourseView/CourseChat/MentionTextarea";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";

import type { FormEvent } from "react";
import type { MentionableUser } from "~/api/queries/course-chat/courseChatTypes";

type ForumReplyFormProps = {
  users: MentionableUser[];
  isSubmitting: boolean;
  onSubmit: (content: string, onSent: () => void) => void;
};

export function ForumReplyForm({ users, isSubmitting, onSubmit }: ForumReplyFormProps) {
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
      <MentionTextarea
        value={content}
        onChange={setContent}
        users={users}
        placeholder={t("forum.topic.replyPlaceholder")}
        maxLength={FORUM_POST_MAX_LENGTH}
        className="min-h-24"
        testIds={{
          input: FORUM_HANDLES.REPLY_INPUT,
          mentionList: FORUM_HANDLES.MENTION_LIST,
          mentionOption: FORUM_HANDLES.mentionOption,
        }}
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
