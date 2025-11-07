import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { useCurrentUserSuspense } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { variants } from "~/modules/Courses/Lesson/AiMentorLesson/components/variants";
import "katex/dist/katex.min.css";

interface ChatMessageProps {
  id: string;
  role: string;
  content: string;
  user?: { name?: string; email?: string };
  name?: string;
  email?: string;
}
const ChatMessage = (message: ChatMessageProps) => {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUserSuspense();

  const isAI = message.role === "assistant";
  let userName = t("studentCourseView.lesson.aiMentorLesson.aiMentorName");

  if (!isAI) {
    userName =
      message.user?.name ||
      message.name ||
      `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim() ||
      t("studentCourseView.lesson.aiMentorLesson.userName");
  }

  return (
    <div key={message.id} className="flex items-start gap-x-3 max-w-full">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full">
        {isAI ? (
          <div className="flex size-full items-center justify-center rounded-full bg-primary-100">
            <Icon name="AiMentor" className="size-5 text-primary-600" />
          </div>
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-gray-200">
            <UserAvatar userName={userName} profilePictureUrl={currentUser.profilePictureUrl} />
          </div>
        )}
      </div>
      <div className="max-w-[90%] overflow-x-hidden flex flex-col">
        <span className="mb-1 text-sm font-semibold text-primary-900">{userName}</span>
        <p className="break-words text-sm leading-relaxed overflow-x-scroll scrollbar-hide text-gray-800">
          {isAI ? (
            <Markdown
              components={variants}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {message.content}
            </Markdown>
          ) : (
            message.content
          )}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
