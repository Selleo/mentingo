import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateComment,
  useCreateThread,
  useDeleteComment,
  useDeleteThread,
  useDiscussionDetail,
  useModerateComment,
  useModerateThread,
  useUpdateComment,
  useUpdateThread,
} from "~/api/mutations/useDiscussions";
import { useCurrentUser } from "~/api/queries";
import { useDiscussions } from "~/api/queries/useDiscussions";
import { ContentEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";

import type { CourseDiscussionComment, CourseDiscussionThread } from "~/api/types/discussion.types";

const STATUS_LABELS = {
  visible: null,
  deleted_by_author: "deleted_by_author",
  hidden_by_staff: "hidden_by_staff",
} as const;

function ThreadList({
  threads,
  onSelect,
  selectedThreadId,
}: {
  threads: CourseDiscussionThread[];
  onSelect: (threadId: string) => void;
  selectedThreadId?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      {threads.map((thread) => {
        const isSelected = selectedThreadId === thread.id;
        const isPlaceholder =
          thread.status === "deleted_by_author" || thread.status === "hidden_by_staff";

        return (
          <button
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
              isSelected && "border-primary bg-muted/30",
              isPlaceholder && "opacity-60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium line-clamp-1">{thread.title}</span>
              {thread.status !== "visible" && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t(`studentCourseView.discussions.status.${STATUS_LABELS[thread.status]}`)}
                </span>
              )}
            </div>
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {isPlaceholder
                ? t("studentCourseView.discussions.contentUnavailable")
                : thread.content.replace(/<[^>]*>/g, "").slice(0, 150)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CreateThreadForm({ courseId, onCancel }: { courseId: string; onCancel: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createThread = useCreateThread();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (title.trim().length < 3) {
      toast({ description: t("studentCourseView.discussions.errors.titleMinLength") });
      return;
    }
    if (content.replace(/<[^>]*>/g, "").trim().length < 1) {
      toast({ description: t("studentCourseView.discussions.errors.contentMinLength") });
      return;
    }

    createThread.mutate(
      { courseId, data: { title: title.trim(), content } },
      {
        onSuccess: () => {
          toast({ description: t("studentCourseView.discussions.threadCreated") });
          setTitle("");
          setContent("");
          onCancel();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("studentCourseView.discussions.titlePlaceholder")}
        maxLength={150}
        data-testid="create-thread-title"
      />
      <ContentEditor
        content={content}
        onChange={setContent}
        placeholder={t("studentCourseView.discussions.contentPlaceholder")}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={createThread.isPending}>
          {createThread.isPending
            ? t("common.loading")
            : t("studentCourseView.discussions.createThread")}
        </Button>
      </div>
    </form>
  );
}

function CommentForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (content: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.replace(/<[^>]*>/g, "").trim().length < 1) return;
    onSubmit(content);
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <ContentEditor
        content={content}
        onChange={setContent}
        placeholder={t("studentCourseView.discussions.addCommentPlaceholder")}
        parentClassName="flex-1"
      />
      <Button type="submit" disabled={isPending} size="sm">
        {t("common.send")}
      </Button>
    </form>
  );
}

function CommentItem({
  comment,
  currentUserId,
  isModerator,
  onEdit,
  onDelete,
  onHide,
}: {
  comment: CourseDiscussionComment;
  currentUserId?: string;
  isModerator: boolean;
  onEdit: (comment: CourseDiscussionComment) => void;
  onDelete: (commentId: string) => void;
  onHide: (commentId: string, hidden: boolean) => void;
}) {
  const { t } = useTranslation();
  const isPlaceholder = comment.status !== "visible";
  const isAuthor = currentUserId === comment.authorId;

  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border p-3", isPlaceholder && "opacity-60")}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {new Date(comment.createdAt).toLocaleDateString()}
        </span>
        <div className="flex gap-1">
          {isPlaceholder && (
            <span className="text-xs text-muted-foreground">
              {t(`studentCourseView.discussions.status.${STATUS_LABELS[comment.status]}`)}
            </span>
          )}
          {!isPlaceholder && isAuthor && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(comment)}>
              {t("common.edit")}
            </Button>
          )}
          {!isPlaceholder && isAuthor && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(comment.id)}>
              {t("common.delete")}
            </Button>
          )}
          {!isPlaceholder && isModerator && (
            <Button variant="ghost" size="sm" onClick={() => onHide(comment.id, true)}>
              {t("common.hide")}
            </Button>
          )}
          {!isPlaceholder && isModerator && comment.status === "hidden_by_staff" && (
            <Button variant="ghost" size="sm" onClick={() => onHide(comment.id, false)}>
              {t("common.unhide")}
            </Button>
          )}
        </div>
      </div>
      <div className="text-sm">
        {isPlaceholder ? t("studentCourseView.discussions.contentUnavailable") : comment.content}
      </div>
    </div>
  );
}

function ThreadDetail({
  thread,
  courseId,
  onBack,
  currentUserId,
  isModerator,
}: {
  thread: CourseDiscussionThread;
  courseId: string;
  onBack: () => void;
  currentUserId?: string;
  isModerator: boolean;
}) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useDiscussionDetail(thread.id);

  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const moderateComment = useModerateComment();

  const [editingComment, setEditingComment] = useState<CourseDiscussionComment | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTitle, setEditingTitle] = useState(thread.title);
  const [editingContent, setEditingContent] = useState(thread.content);

  const updateThread = useUpdateThread();
  const deleteThread = useDeleteThread();
  const moderateThread = useModerateThread();

  const isAuthor = currentUserId === thread.authorId;
  const isPlaceholder = thread.status !== "visible";

  const handleCreateComment = (content: string) => {
    createComment.mutate(
      { threadId: thread.id, courseId, data: { content } },
      {
        onSuccess: () => toast({ description: t("studentCourseView.discussions.commentCreated") }),
      },
    );
  };

  const handleUpdateComment = (comment: CourseDiscussionComment, content: string) => {
    updateComment.mutate(
      { commentId: comment.id, threadId: thread.id, data: { content } },
      {
        onSuccess: () => {
          setEditingComment(null);
          setShowEditForm(false);
        },
      },
    );
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate({ commentId, threadId: thread.id });
  };

  const handleHideComment = (commentId: string, hidden: boolean) => {
    moderateComment.mutate({ commentId, threadId: thread.id, hidden });
  };

  const handleUpdateThread = () => {
    updateThread.mutate(
      { threadId: thread.id, courseId, data: { title: editingTitle, content: editingContent } },
      {
        onSuccess: () => {
          setShowEditForm(false);
          toast({ description: t("studentCourseView.discussions.threadUpdated") });
        },
      },
    );
  };

  const handleDeleteThread = () => {
    deleteThread.mutate({ threadId: thread.id, courseId }, { onSuccess: () => onBack() });
  };

  const handleHideThread = (hidden: boolean) => {
    moderateThread.mutate({ threadId: thread.id, courseId, hidden });
  };

  if (isLoading) {
    return <div data-testid="thread-detail-loading">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← {t("studentCourseView.discussions.backToThreads")}
      </Button>

      <div className="flex flex-col gap-1 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          {showEditForm ? (
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              className="font-medium"
              data-testid="edit-thread-title"
            />
          ) : (
            <h3 className="font-medium">{thread.title}</h3>
          )}
          {thread.status !== "visible" && (
            <span className="text-xs text-muted-foreground">
              {t(`studentCourseView.discussions.status.${STATUS_LABELS[thread.status]}`)}
            </span>
          )}
        </div>

        {showEditForm ? (
          <>
            <ContentEditor content={editingContent} onChange={setEditingContent} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditForm(false)}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleUpdateThread}>
                {t("common.save")}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm">
            {isPlaceholder ? t("studentCourseView.discussions.contentUnavailable") : thread.content}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {new Date(thread.createdAt).toLocaleDateString()}
          </span>
          <div className="flex gap-1">
            {!isPlaceholder && isAuthor && (
              <Button variant="ghost" size="sm" onClick={() => setShowEditForm(true)}>
                {t("common.edit")}
              </Button>
            )}
            {!isPlaceholder && isAuthor && (
              <Button variant="ghost" size="sm" onClick={handleDeleteThread}>
                {t("common.delete")}
              </Button>
            )}
            {!isPlaceholder && isModerator && (
              <Button variant="ghost" size="sm" onClick={() => handleHideThread(true)}>
                {t("common.hide")}
              </Button>
            )}
            {!isPlaceholder && isModerator && thread.status === "hidden_by_staff" && (
              <Button variant="ghost" size="sm" onClick={() => handleHideThread(false)}>
                {t("common.unhide")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!editingComment && (
        <CommentForm onSubmit={handleCreateComment} isPending={createComment.isPending} />
      )}

      {editingComment && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <ContentEditor
            content={editingComment.content}
            onChange={(val) =>
              setEditingComment(editingComment ? { ...editingComment, content: val } : null)
            }
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingComment(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => handleUpdateComment(editingComment, editingComment.content)}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">{t("studentCourseView.discussions.comments")}</h4>
        {detail?.comments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("studentCourseView.discussions.noComments")}
          </p>
        )}
        {detail?.comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            isModerator={isModerator}
            onEdit={setEditingComment}
            onDelete={handleDeleteComment}
            onHide={handleHideComment}
          />
        ))}
      </div>
    </div>
  );
}

export function CourseDiscussions({
  courseId,
  courseAuthorId,
}: {
  courseId: string;
  courseAuthorId: string;
}) {
  const { t } = useTranslation();
  const { data: threads, isLoading } = useDiscussions(courseId);
  const { data: currentUser } = useCurrentUser();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const selectedThread = threads?.find((t) => t.id === selectedThreadId) ?? null;
  const isModerator =
    currentUser?.roleSlugs?.includes(SYSTEM_ROLE_SLUGS.ADMIN) === true ||
    currentUser?.id === courseAuthorId;

  if (isLoading) {
    return (
      <div data-testid="discussions-loading">{t("studentCourseView.discussions.loading")}</div>
    );
  }

  if (!threads?.length) {
    return (
      <div className="flex flex-col gap-4">
        <div data-testid="discussions-empty">{t("studentCourseView.discussions.empty")}</div>
        {!showCreateForm ? (
          <Button onClick={() => setShowCreateForm(true)}>
            {t("studentCourseView.discussions.createFirstThread")}
          </Button>
        ) : (
          <CreateThreadForm courseId={courseId} onCancel={() => setShowCreateForm(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div data-testid="discussions-list">
        {!selectedThread && !showCreateForm && (
          <div className="flex flex-col gap-4">
            <Button onClick={() => setShowCreateForm(true)}>
              {t("studentCourseView.discussions.createThread")}
            </Button>
            {showCreateForm && (
              <CreateThreadForm courseId={courseId} onCancel={() => setShowCreateForm(false)} />
            )}
            <ThreadList
              threads={threads ?? []}
              onSelect={setSelectedThreadId}
              selectedThreadId={selectedThreadId ?? undefined}
            />
          </div>
        )}

        {selectedThread && (
          <ThreadDetail
            thread={selectedThread}
            courseId={courseId}
            onBack={() => setSelectedThreadId(null)}
            currentUserId={currentUser?.id}
            isModerator={isModerator}
          />
        )}
      </div>
    </div>
  );
}
