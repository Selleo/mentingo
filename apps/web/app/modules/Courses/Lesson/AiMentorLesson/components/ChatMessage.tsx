import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { Icon } from "~/components/Icon";

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
    <div key={message.id} className="flex items-start gap-x-3">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full">
        {isAI ? (
          <div className="flex size-full items-center justify-center rounded-full bg-blue-100">
            <Icon name="AiMentor" className="size-5 text-blue-600" />
          </div>
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-gray-200">
            <Icon name="User" className="size-5 text-gray-500" />
          </div>
        )}
      </div>
      <div className="flex max-w-[80%] flex-col">
        <span className="mb-1 text-sm font-semibold text-blue-900">{userName}</span>
        <p className="break-words text-sm leading-relaxed text-gray-800">{message.content}</p>
      </div>
    </div>
  );
};

export default ChatMessage;
