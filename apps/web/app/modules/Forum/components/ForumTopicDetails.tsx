import { Link, useNavigate, useSearchParams } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { useDeferredValue } from "react";
import { useTranslation } from "react-i18next";

import { useCreateForumPost } from "~/api/mutations/useCreateForumPost";
import { useDeleteForumPost } from "~/api/mutations/useDeleteForumPost";
import {
  FORUM_POSTS_PER_PAGE,
  useForumTopicPostsSuspense,
} from "~/api/queries/forum/useForumTopicPosts";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useClampedPage } from "~/components/DataTable";
import { Pagination } from "~/components/Pagination/Pagination";
import { Badge } from "~/components/ui/badge";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";
import {
  canDeleteForumPost,
  canReplyInTopic,
  getLastPage,
  getTopicHeading,
  parsePageParam,
} from "../forum.utils";

import { ForumPostCard } from "./ForumPostCard";
import { ForumReplyForm } from "./ForumReplyForm";

import type { ForumPost, ForumTopic } from "~/api/queries/forum/forumTypes";

type ForumTopicDetailsProps = {
  topic: ForumTopic;
};

export function ForumTopicDetails({ topic }: ForumTopicDetailsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const { data: currentUser } = useCurrentUser();
  const permissions = currentUser?.permissions ?? [];
  const courseId = topic.course?.id ?? null;
  const firstPostId = topic.firstPost.id;

  const deferredPage = useDeferredValue(page);
  const { data: posts } = useForumTopicPostsSuspense(topic.id, deferredPage);
  const totalReplies = posts.pagination.totalItems;
  const { mutate: createPost, isPending: isSendingReply } = useCreateForumPost({
    topicId: topic.id,
    firstPostId,
    courseId,
  });
  const { mutate: deletePost, isPending: isDeletingPost } = useDeleteForumPost({
    firstPostId,
    courseId,
  });

  const isClosed = Boolean(topic.firstPost.deletedAt);
  const canReply = !isClosed && canReplyInTopic(topic.scope, permissions);

  const goToPage = (nextPage: number) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (nextPage > 1) next.set("page", String(nextPage));
        else next.delete("page");

        return next;
      },
      { replace: true },
    );
  };

  useClampedPage({
    page,
    perPage: FORUM_POSTS_PER_PAGE,
    totalItems: totalReplies,
    setPage: goToPage,
  });

  const canDelete = (post: ForumPost) =>
    !post.deletedAt &&
    canDeleteForumPost({
      authorId: post.userId,
      currentUserId: currentUser?.id,
      scope: topic.scope,
      permissions,
    });

  const handleReply = (content: string, onSent: () => void) => {
    createPost(content, {
      onSuccess: () => {
        onSent();
        goToPage(getLastPage(totalReplies + 1, FORUM_POSTS_PER_PAGE));
      },
    });
  };

  const handleDelete = (postId: string, onDeleted: () => void) => {
    deletePost(postId, {
      onSuccess: (result) => {
        onDeleted();

        if (result.topicRemoved) navigate("/forum");
      },
    });
  };

  return (
    <section className="flex flex-col gap-6" data-testid={FORUM_HANDLES.TOPIC_PAGE}>
      <div className="space-y-3">
        <Link
          to="/forum"
          className="body-sm-md inline-flex items-center gap-1 text-primary-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("forum.topic.backToForum")}
        </Link>
        <h1 className="h4 break-words text-neutral-950" data-testid={FORUM_HANDLES.TOPIC_TITLE}>
          {getTopicHeading(topic, t)}
        </h1>
        {topic.course && (
          <Link
            to={`/course/${topic.course.id}`}
            className="inline-flex"
            data-testid={FORUM_HANDLES.TOPIC_COURSE_LINK}
          >
            <Badge variant="secondary">{topic.course.title}</Badge>
          </Link>
        )}
      </div>

      <ForumPostCard
        post={topic.firstPost}
        canDelete={canDelete(topic.firstPost)}
        isDeleting={isDeletingPost}
        onDelete={handleDelete}
      />

      <div className="space-y-3">
        <h2 className="body-base-md text-neutral-950">
          {t("forum.replies", { count: totalReplies })}
        </h2>
        {totalReplies === 0 && (
          <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.NO_REPLIES}>
            {t("forum.topic.noReplies")}
          </p>
        )}
        {posts.data.map((post) => (
          <ForumPostCard
            key={post.id}
            post={post}
            canDelete={canDelete(post)}
            isDeleting={isDeletingPost}
            onDelete={handleDelete}
          />
        ))}
        {totalReplies > FORUM_POSTS_PER_PAGE && (
          <Pagination
            totalItems={totalReplies}
            itemsPerPage={FORUM_POSTS_PER_PAGE}
            currentPage={page}
            canChangeItemsPerPage={false}
            onPageChange={goToPage}
          />
        )}
      </div>

      {canReply && <ForumReplyForm isSubmitting={isSendingReply} onSubmit={handleReply} />}
      {isClosed && (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.TOPIC_CLOSED}>
          {t("forum.topic.closed")}
        </p>
      )}
    </section>
  );
}
