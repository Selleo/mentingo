import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";

import { DeleteForumPostDialog } from "./DeleteForumPostDialog";

import type { ForumPost } from "~/api/queries/forum/forumTypes";

type ForumPostCardProps = {
  post: ForumPost;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: (postId: string, onDeleted: () => void) => void;
};

export function ForumPostCard({ post, canDelete, isDeleting, onDelete }: ForumPostCardProps) {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const isDeleted = Boolean(post.deletedAt);
  const authorName = `${post.user.firstName} ${post.user.lastName}`;

  return (
    <article
      className={cn("flex gap-3 rounded-lg border p-4", {
        "border-dashed border-neutral-200 bg-neutral-50": isDeleted,
        "border-neutral-200 bg-white": !isDeleted,
      })}
      data-testid={FORUM_HANDLES.post(post.id)}
    >
      {!isDeleted && (
        <UserAvatar
          className="size-10 shrink-0"
          userName={authorName}
          profilePictureUrl={post.user.avatarReference}
        />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        {!isDeleted && (
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="body-sm-md text-neutral-950">{authorName}</span>
              <span className="text-xs text-neutral-500">
                {format(new Date(post.createdAt), "dd.MM.yyyy HH:mm")}
              </span>
            </div>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-neutral-600 hover:text-error-700"
                aria-label={t("forum.deletePost")}
                onClick={() => setIsDeleteDialogOpen(true)}
                data-testid={FORUM_HANDLES.postDeleteButton(post.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        )}
        <p
          className={cn("body-sm whitespace-pre-wrap break-words", {
            "italic text-neutral-500": isDeleted,
            "text-neutral-900": !isDeleted,
          })}
          data-testid={FORUM_HANDLES.postContent(post.id)}
        >
          {isDeleted ? t("forum.deletedPost") : post.content}
        </p>
      </div>
      {canDelete && (
        <DeleteForumPostDialog
          open={isDeleteDialogOpen}
          isDeleting={isDeleting}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={() => onDelete(post.id, () => setIsDeleteDialogOpen(false))}
        />
      )}
    </article>
  );
}
