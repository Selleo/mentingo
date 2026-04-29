import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { useCourseCommentReplies, useDeleteCourseComment } from "./api";
import { CommentRow } from "./CommentRow";

import type { CourseComment } from "./types";

type Props = {
  courseId: string;
  parentCommentId: string;
  inlinedReplies: CourseComment[];
  totalReplyCount: number;
  currentUserId: string | null | undefined;
  canModerate: boolean;
};

export function RepliesExpander({
  courseId,
  parentCommentId,
  inlinedReplies,
  totalReplyCount,
  currentUserId,
  canModerate,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const remaining = Math.max(0, totalReplyCount - inlinedReplies.length);

  const repliesQuery = useCourseCommentReplies(courseId, parentCommentId, expanded);
  const deleteMutation = useDeleteCourseComment(courseId);

  const inlinedIds = new Set(inlinedReplies.map((r) => r.id));
  const expandedReplies = expanded
    ? (repliesQuery.data?.pages ?? []).flatMap((page) => page.data.data)
    : [];
  const merged = [...inlinedReplies, ...expandedReplies.filter((r) => !inlinedIds.has(r.id))];

  if (merged.length === 0 && remaining === 0) return null;

  return (
    <div className="ml-12 mt-3 flex flex-col gap-3">
      {merged.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          courseId={courseId}
          currentUserId={currentUserId}
          canModerate={canModerate}
          onDelete={() => deleteMutation.mutate({ commentId: reply.id, parentCommentId })}
        />
      ))}
      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-sm text-primary-700 hover:underline"
        >
          {t("courseDiscussion.list.viewMoreReplies", { count: remaining })}
        </button>
      )}
      {expanded && repliesQuery.hasNextPage && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => repliesQuery.fetchNextPage()}
          disabled={repliesQuery.isFetchingNextPage}
        >
          {repliesQuery.isFetchingNextPage
            ? t("courseDiscussion.list.loading")
            : t("courseDiscussion.list.loadMore")}
        </Button>
      )}
    </div>
  );
}
