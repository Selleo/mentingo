import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateCourseDiscussionComment } from "~/api/mutations/useCreateCourseDiscussionComment";
import {
  useCourseDiscussionComments,
  type CourseDiscussionComment,
} from "~/api/queries/useCourseDiscussionComments";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

import type { CourseDiscussionPost } from "~/api/queries/useCourseDiscussionPosts";

type CourseDiscussionCommentsProps = {
  courseId: string;
  post: CourseDiscussionPost;
};

type CommentDraftState = {
  root: string;
  replies: Record<string, string>;
};

export function CourseDiscussionComments({ courseId, post }: CourseDiscussionCommentsProps) {
  const { t } = useTranslation();
  const { data: comments = [], isLoading } = useCourseDiscussionComments(courseId, post.id);
  const { mutate: createComment, isPending: isCreatingComment } = useCreateCourseDiscussionComment(
    courseId,
    post.id,
  );
  const [drafts, setDrafts] = useState<CommentDraftState>({ root: "", replies: {} });
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);

  const commentsByParentId = useMemo(() => {
    const rootComments = comments.filter((comment) => comment.parentCommentId === null);
    const repliesByParentId = comments.reduce<Record<string, typeof comments>>((acc, comment) => {
      if (!comment.parentCommentId) return acc;

      acc[comment.parentCommentId] = [...(acc[comment.parentCommentId] ?? []), comment];
      return acc;
    }, {});

    return { rootComments, repliesByParentId };
  }, [comments]);

  const submitRootComment = () => {
    const content = drafts.root.trim();
    if (!content) return;

    createComment(
      { content },
      {
        onSuccess: () => setDrafts((current) => ({ ...current, root: "" })),
      },
    );
  };

  const submitReply = (parentCommentId: string) => {
    const content = drafts.replies[parentCommentId]?.trim();
    if (!content) return;

    createComment(
      { content, parentCommentId },
      {
        onSuccess: () =>
          setDrafts((current) => ({
            ...current,
            replies: { ...current.replies, [parentCommentId]: "" },
          })),
      },
    );
  };

  return (
    <div className="space-y-4 border-t border-neutral-200 pt-4">
      <div className="space-y-3">
        <Textarea
          value={drafts.root}
          onChange={(event) => setDrafts((current) => ({ ...current, root: event.target.value }))}
          placeholder={t("studentCourseView.discussion.comment.placeholder")}
          className="min-h-24"
        />
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={submitRootComment}
            disabled={isCreatingComment || drafts.root.trim().length === 0}
          >
            {t("studentCourseView.discussion.comment.submit")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="body-sm text-neutral-700">
          {t("studentCourseView.discussion.loadingComments")}
        </p>
      ) : comments.length === 0 ? (
        <p className="body-sm text-neutral-700">{t("studentCourseView.discussion.noComments")}</p>
      ) : (
        <div className="space-y-4">
          {commentsByParentId.rootComments.map((comment) => (
            <div key={comment.id} className="space-y-3 rounded-lg border border-neutral-200 p-4">
              <CommentRow comment={comment} />
              {commentsByParentId.repliesByParentId[comment.id]?.length ? (
                <div className="space-y-3 border-l-2 border-neutral-200 pl-4">
                  {commentsByParentId.repliesByParentId[comment.id].map((reply) => (
                    <CommentRow key={reply.id} comment={reply} />
                  ))}
                </div>
              ) : null}
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setOpenReplyFor((current) => (current === comment.id ? null : comment.id))
                  }
                >
                  {t("studentCourseView.discussion.comment.reply")}
                </Button>
              </div>
              {openReplyFor === comment.id && (
                <div className="space-y-3">
                  <Textarea
                    value={drafts.replies[comment.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        replies: { ...current.replies, [comment.id]: event.target.value },
                      }))
                    }
                    placeholder={t("studentCourseView.discussion.comment.replyPlaceholder")}
                    className="min-h-20"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => submitReply(comment.id)}
                      disabled={
                        isCreatingComment || (drafts.replies[comment.id]?.trim().length ?? 0) === 0
                      }
                    >
                      {t("studentCourseView.discussion.comment.submitReply")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment }: { comment: CourseDiscussionComment }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Avatar className="size-8">
          <AvatarImage src={comment.authorAvatarUrl ?? undefined} alt={comment.authorName} />
          <AvatarFallback>{comment.authorName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="body-sm-md text-neutral-900">{comment.authorName}</span>
            <span className="body-sm text-neutral-600">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
            {comment.isHelpfulAnswer && (
              <Badge variant="secondary">{t("studentCourseView.discussion.comment.helpful")}</Badge>
            )}
          </div>
          <p className="body-sm text-neutral-900 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}
