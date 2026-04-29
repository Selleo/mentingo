import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";

import { useUpdateCourseComment } from "./api";
import { CommentComposer } from "./CommentComposer";
import { COMMENT_CONTENT_MAX, type CourseComment } from "./types";
import { renderCommentContent } from "./utils";

type Props = {
  comment: CourseComment;
  courseId: string;
  currentUserId: string | null | undefined;
  canModerate: boolean;
  onReply?: () => void;
  onDelete?: () => void;
  isReplying?: boolean;
  showReplyAction?: boolean;
  onCloseReply?: () => void;
  onReplySubmit?: (content: string) => Promise<void>;
  isReplyPending?: boolean;
};

const formatTimestamp = (raw: string) => {
  try {
    return new Date(raw).toLocaleString();
  } catch {
    return raw;
  }
};

export function CommentRow({
  comment,
  courseId,
  currentUserId,
  canModerate,
  onReply,
  onDelete,
  isReplying = false,
  showReplyAction = false,
  onCloseReply,
  onReplySubmit,
  isReplyPending = false,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);

  const updateMutation = useUpdateCourseComment(courseId);

  const isOwner = !!currentUserId && comment.author?.id === currentUserId;
  const canDelete = (isOwner || canModerate) && !comment.isDeleted;
  const canEdit = isOwner && !comment.isDeleted;

  const startEdit = () => {
    setEditValue(comment.content);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue(comment.content);
  };

  const submitEdit = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    await updateMutation.mutateAsync({ commentId: comment.id, content: trimmed });
    setEditing(false);
  };

  const authorName = comment.author
    ? `${comment.author.firstName} ${comment.author.lastName}`.trim()
    : t("courseDiscussion.deleted");

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0">
        <UserAvatar
          userName={authorName}
          profilePictureUrl={comment.author?.profilePictureUrl ?? undefined}
          className="h-9 w-9"
        />
      </div>
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="body-sm font-medium text-neutral-900">{authorName}</span>
          <span className="body-xs text-neutral-500">{formatTimestamp(comment.createdAt)}</span>
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={editValue}
              onChange={(event) => setEditValue(event.target.value.slice(0, COMMENT_CONTENT_MAX))}
              maxLength={COMMENT_CONTENT_MAX}
              rows={3}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={cancelEdit} disabled={updateMutation.isPending}>
                {t("courseDiscussion.actions.cancel")}
              </Button>
              <Button onClick={submitEdit} disabled={!editValue.trim() || updateMutation.isPending}>
                {t("courseDiscussion.actions.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="body-sm text-neutral-800 whitespace-pre-wrap break-words">
            {comment.isDeleted ? (
              <span className="italic text-neutral-500">{t("courseDiscussion.deleted")}</span>
            ) : (
              renderCommentContent(comment.content)
            )}
          </div>
        )}
        {!editing && !comment.isDeleted && (
          <div className="flex items-center gap-3 text-xs text-neutral-600">
            {showReplyAction && onReply && (
              <button
                type="button"
                onClick={onReply}
                className="hover:underline"
                disabled={isReplyPending}
              >
                {t("courseDiscussion.actions.reply")}
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={startEdit} className="hover:underline">
                {t("courseDiscussion.actions.edit")}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    if (!window.confirm(t("courseDiscussion.deleteConfirm"))) return;
                  }
                  onDelete?.();
                }}
                className="hover:underline text-red-600"
              >
                {t("courseDiscussion.actions.delete")}
              </button>
            )}
          </div>
        )}
        {isReplying && onReplySubmit && (
          <div className="mt-2">
            <CommentComposer
              onSubmit={onReplySubmit}
              isPending={isReplyPending}
              variant="reply"
              {...({ autoFocus: true } as { autoFocus?: boolean })}
              onCancel={onCloseReply}
            />
          </div>
        )}
      </div>
    </div>
  );
}
