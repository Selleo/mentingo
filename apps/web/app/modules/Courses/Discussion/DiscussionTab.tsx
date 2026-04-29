import { PERMISSIONS } from "@repo/shared";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { Button } from "~/components/ui/button";

import { useCourseComments, useCreateCourseComment, useDeleteCourseComment } from "./api";
import { CommentComposer, type CommentComposerHandle } from "./CommentComposer";
import { CommentRow } from "./CommentRow";
import { RepliesExpander } from "./RepliesExpander";

type Props = {
  courseId: string;
  courseAuthorId?: string | null;
};

export function DiscussionTab({ courseId, courseAuthorId }: Props) {
  const { t } = useTranslation();
  const composerRef = useRef<CommentComposerHandle>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const { data: currentUser } = useCurrentUser();
  const commentsQuery = useCourseComments(courseId);
  const createMutation = useCreateCourseComment(courseId);
  const deleteMutation = useDeleteCourseComment(courseId);

  const comments = (commentsQuery.data?.pages ?? []).flatMap((page) => page.data.data);

  const isAdmin = !!currentUser?.permissions?.includes(PERMISSIONS.COURSE_UPDATE);
  const isCourseAuthor = !!courseAuthorId && currentUser?.id === courseAuthorId;
  const canModerate = isAdmin || isCourseAuthor;

  const handleSubmitTopLevel = async (content: string) => {
    await createMutation.mutateAsync({ content });
  };

  const handleSubmitReply = (parentCommentId: string) => async (content: string) => {
    await createMutation.mutateAsync({ content, parentCommentId });
    setReplyingTo(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <CommentComposer
        ref={composerRef}
        onSubmit={handleSubmitTopLevel}
        isPending={createMutation.isPending}
      />

      {commentsQuery.isLoading && (
        <div className="text-neutral-500 text-sm">{t("courseDiscussion.list.loading")}</div>
      )}

      {!commentsQuery.isLoading && comments.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-8 text-center">
          <h3 className="h6 text-neutral-900">{t("courseDiscussion.empty.title")}</h3>
          <p className="body-sm text-neutral-600">{t("courseDiscussion.empty.description")}</p>
          <Button onClick={() => composerRef.current?.focus()}>
            {t("courseDiscussion.composer.submit")}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {comments.map((comment) => (
          <div key={comment.id} className="flex flex-col gap-2">
            <CommentRow
              comment={comment}
              courseId={courseId}
              currentUserId={currentUser?.id}
              canModerate={canModerate}
              showReplyAction
              onReply={() => setReplyingTo(comment.id)}
              onCloseReply={() => setReplyingTo(null)}
              onReplySubmit={handleSubmitReply(comment.id)}
              isReplying={replyingTo === comment.id}
              isReplyPending={createMutation.isPending}
              onDelete={() => deleteMutation.mutate({ commentId: comment.id })}
            />
            <RepliesExpander
              courseId={courseId}
              parentCommentId={comment.id}
              inlinedReplies={comment.replies}
              totalReplyCount={comment.replyCount}
              currentUserId={currentUser?.id}
              canModerate={canModerate}
            />
          </div>
        ))}
      </div>

      {commentsQuery.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => commentsQuery.fetchNextPage()}
          disabled={commentsQuery.isFetchingNextPage}
        >
          {commentsQuery.isFetchingNextPage
            ? t("courseDiscussion.list.loading")
            : t("courseDiscussion.list.loadMore")}
        </Button>
      )}
    </div>
  );
}
