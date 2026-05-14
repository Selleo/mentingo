import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { useCurrentUserSuspense } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";
import { variants } from "~/modules/Courses/Lesson/AiMentorLesson/components/variants";

import type { LessonPreviewUser } from "~/modules/Courses/Lesson/types";
import "katex/dist/katex.min.css";

interface ChatMessageProps {
  id: string;
  role: "assistant" | "user" | "data" | "system";
  content: string;
  user?: { name?: string; email?: string };
  name?: string;
  email?: string;
  userName?: string;
  aiName?: string | null;
  avatarUrl?: string;
  previewUser?: LessonPreviewUser;
  messageMaxWidthClass?: string;
  testId?: string;
  contentTestId?: string;
}

const ChatMessage = ({
  id,
  role,
  content,
  user,
  name,
  userName,
  aiName,
  avatarUrl,
  previewUser,
  messageMaxWidthClass = "max-w-[90%]",
  testId,
  contentTestId,
}: ChatMessageProps) => {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUserSuspense();

  const isAssistant = role === "assistant";

  const previewDisplayName =
    `${previewUser?.firstName ?? ""} ${previewUser?.lastName ?? ""}`.trim();
  const currentUserDisplayName =
    `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim();

  const profilePictureUrl = useMemo(() => {
    return previewUser ? previewUser.profilePictureUrl : currentUser?.profilePictureUrl;
  }, [previewUser, currentUser?.profilePictureUrl]);

  const displayName = useMemo(() => {
    if (isAssistant) {
      return aiName ?? t("studentCourseView.lesson.aiMentorLesson.aiMentorName");
    }

    const fallbackName = previewUser ? previewDisplayName : currentUserDisplayName;

    return (
      userName ||
      user?.name ||
      name ||
      fallbackName ||
      t("studentCourseView.lesson.aiMentorLesson.userName")
    );
  }, [
    aiName,
    currentUserDisplayName,
    isAssistant,
    name,
    previewDisplayName,
    previewUser,
    t,
    user?.name,
    userName,
  ]);

  return (
    <div
      key={id}
      data-testid={testId}
      className={cn(
        "flex max-w-full gap-3",
        isAssistant ? "flex-row items-start" : "flex-row-reverse items-end",
      )}
    >
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full">
        {isAssistant ? (
          <Avatar className="size-full flex items-center justify-center bg-primary-100">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>
              <Icon name="AiMentor" className="p-1 text-primary-600" />
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-gray-200">
            <UserAvatar userName={displayName} profilePictureUrl={profilePictureUrl} />
          </div>
        )}
      </div>

      <div
        className={cn(
          "min-w-0 flex flex-col gap-1",
          messageMaxWidthClass,
          isAssistant ? "items-start" : "items-end",
        )}
      >
        <span className="text-sm font-semibold text-primary-900">{displayName}</span>

        <div
          data-testid={contentTestId}
          className={cn(
            "w-fit max-w-full rounded-xl text-sm leading-relaxed break-words text-gray-800",
            { "px-4 py-2 bg-primary-100": !isAssistant },
          )}
        >
          {isAssistant ? (
            <Markdown
              components={variants}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {content}
            </Markdown>
          ) : (
            content
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
