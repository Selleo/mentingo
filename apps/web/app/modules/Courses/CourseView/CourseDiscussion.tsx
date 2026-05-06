import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateCourseDiscussionPost } from "~/api/mutations/useCreateCourseDiscussionPost";
import {
  useCourseDiscussionPosts,
  type DiscussionFilter,
} from "~/api/queries/useCourseDiscussionPosts";
import { useCourseDiscussionSummary } from "~/api/queries/useCourseDiscussionSummary";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { CourseDiscussionComments } from "~/modules/Courses/CourseView/CourseDiscussionComments";

type CourseDiscussionProps = {
  courseId: string;
  isEnrolled: boolean;
};

export function CourseDiscussion({ courseId, isEnrolled }: CourseDiscussionProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<DiscussionFilter>("all");
  const [postType, setPostType] = useState<"question" | "discussion" | "progress">("question");
  const [content, setContent] = useState("");

  const { data: summary } = useCourseDiscussionSummary(courseId);
  const { data: posts = [], isLoading: isLoadingPosts } = useCourseDiscussionPosts(
    courseId,
    filter,
  );
  const { mutate: createPost, isPending: isCreatingPost } = useCreateCourseDiscussionPost(courseId);

  const completedCount = summary?.completedCount ?? 0;
  const visibleAvatars = summary?.completedStudentAvatars ?? [];
  const extraCompletedCount = Math.max(completedCount - visibleAvatars.length, 0);

  const handleCreatePost = () => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    createPost(
      { type: postType, content: trimmedContent },
      {
        onSuccess: () => {
          setContent("");
          setPostType("question");
        },
      },
    );
  };

  const filters: { key: DiscussionFilter; label: string }[] = [
    { key: "all", label: t("studentCourseView.discussion.filters.all") },
    { key: "questions", label: t("studentCourseView.discussion.filters.questions") },
    { key: "latest", label: t("studentCourseView.discussion.filters.latest") },
    { key: "pinned", label: t("studentCourseView.discussion.filters.pinned") },
  ];

  if (!isEnrolled) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <p className="body-sm text-neutral-700 mb-3">
              {t("studentCourseView.discussion.completed")}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {visibleAvatars.map((avatarUrl, index) => (
                  <Avatar
                    key={`${avatarUrl}-${index}`}
                    className="size-8 border-2 border-background"
                  >
                    <AvatarImage
                      src={avatarUrl}
                      alt={t("studentCourseView.discussion.avatarAlt")}
                    />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="body-base-md text-neutral-900">
                +{extraCompletedCount > 0 ? extraCompletedCount : completedCount}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="body-base-md text-neutral-900">
              {t("studentCourseView.discussion.enrollmentRequired")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <p className="body-sm text-neutral-700 mb-3">
            {t("studentCourseView.discussion.completed")}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {visibleAvatars.map((avatarUrl, index) => (
                <Avatar key={`${avatarUrl}-${index}`} className="size-8 border-2 border-background">
                  <AvatarImage src={avatarUrl} alt={t("studentCourseView.discussion.avatarAlt")} />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="body-base-md text-neutral-900">
              +{extraCompletedCount > 0 ? extraCompletedCount : completedCount}
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="grid gap-3">
              <Select
                value={postType}
                onValueChange={(value) => setPostType(value as typeof postType)}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder={t("studentCourseView.discussion.form.type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">
                    {t("studentCourseView.discussion.form.types.question")}
                  </SelectItem>
                  <SelectItem value="discussion">
                    {t("studentCourseView.discussion.form.types.discussion")}
                  </SelectItem>
                  <SelectItem value="progress">
                    {t("studentCourseView.discussion.form.types.progress")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={t("studentCourseView.discussion.form.contentPlaceholder")}
                className="min-h-28"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleCreatePost}
                  disabled={isCreatingPost || content.trim().length === 0}
                >
                  {t("studentCourseView.discussion.form.submit")}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((filterOption) => (
                <Button
                  key={filterOption.key}
                  variant={filter === filterOption.key ? "primary" : "outline"}
                  onClick={() => setFilter(filterOption.key)}
                >
                  {filterOption.label}
                </Button>
              ))}
            </div>

            {isLoadingPosts ? (
              <p className="body-sm text-neutral-700">
                {t("studentCourseView.discussion.loading")}
              </p>
            ) : posts.length === 0 ? (
              <p className="body-base-md text-neutral-900">
                {t("studentCourseView.discussion.empty")}
              </p>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <Card key={post.id} className="border-neutral-200">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarImage
                            src={post.authorAvatarUrl ?? undefined}
                            alt={post.authorName}
                          />
                          <AvatarFallback>
                            {post.authorName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="body-sm-md text-neutral-900">{post.authorName}</span>
                          <span className="body-sm text-neutral-600">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                          {post.isPinned && (
                            <Badge variant="secondary">
                              {t("studentCourseView.discussion.post.pinned")}
                            </Badge>
                          )}
                          <Badge variant="outline">{post.type}</Badge>
                        </div>
                      </div>
                      <p className="body-base text-neutral-900 whitespace-pre-wrap">
                        {post.content}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 body-sm text-neutral-700">
                        <span>
                          {t("studentCourseView.discussion.post.comments", {
                            count: post.commentsCount,
                          })}
                        </span>
                        <span>👍 {post.reactions.like}</span>
                        <span>❤️ {post.reactions.heart}</span>
                        <span>🎉 {post.reactions.celebrate}</span>
                      </div>
                      <CourseDiscussionComments courseId={courseId} post={post} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
