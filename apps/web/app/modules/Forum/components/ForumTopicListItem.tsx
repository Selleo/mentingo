import { Link } from "@remix-run/react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";

import type { ForumTopicListItem as ForumTopicListItemData } from "~/api/queries/forum/forumTypes";

type ForumTopicListItemProps = {
  topic: ForumTopicListItemData;
};

export function ForumTopicListItem({ topic }: ForumTopicListItemProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const authorName = `${topic.author.firstName} ${topic.author.lastName}`;
  const preview = topic.isDeleted ? t("forum.deletedPost") : topic.excerpt;
  const lastActivity = formatDistanceToNow(new Date(topic.lastActivityAt), {
    addSuffix: true,
    locale: getDateLocale(language),
  });

  return (
    <Link
      to={`/forum/topics/${topic.id}`}
      className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
      data-testid={FORUM_HANDLES.topicItem(topic.id)}
    >
      <UserAvatar
        className="size-10 shrink-0"
        userName={authorName}
        profilePictureUrl={topic.author.avatarReference}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            className="body-base-md line-clamp-1 break-all text-neutral-950"
            data-testid={FORUM_HANDLES.topicItemTitle(topic.id)}
          >
            {topic.title ?? preview}
          </h2>
          {topic.course && (
            <Badge variant="secondary" data-testid={FORUM_HANDLES.topicItemCourse(topic.id)}>
              {topic.course.title}
            </Badge>
          )}
        </div>
        {topic.title && (
          <p className="body-sm line-clamp-2 break-words text-neutral-600">{preview}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
          <span>{authorName}</span>
          <span
            className="flex items-center gap-1"
            data-testid={FORUM_HANDLES.topicItemReplies(topic.id)}
          >
            <MessageSquare className="size-3.5" aria-hidden />
            {t("forum.replies", { count: topic.replyCount })}
          </span>
          <span>{t("forum.lastActivity", { time: lastActivity })}</span>
        </div>
      </div>
    </Link>
  );
}
