import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

const ChatLoader = ({ aiName, avatarUrl }: { aiName?: string; avatarUrl?: string }) => {
  const { t } = useTranslation();
  const displayName = aiName ?? t("studentCourseView.lesson.aiMentorLesson.aiMentorName");

  return (
    <div className="flex max-w-full gap-3 items-start">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full">
        <Avatar className="size-full flex items-center justify-center bg-primary-100">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>
            <Icon name="AiMentor" className="p-1 text-primary-600" />
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="min-w-0 max-w-[90%] flex flex-col gap-1 items-start">
        <span className="text-sm font-semibold text-primary-900">{displayName}</span>
        <div className="w-fit max-w-full rounded-xl text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-gray-400 animate-bounce" />
              <span className="size-2 rounded-full bg-gray-400 animate-bounce delay-100" />
              <span className="size-2 rounded-full bg-gray-400 animate-bounce delay-200" />
            </div>
            <span>{t("studentCourseView.lesson.aiMentorLesson.typing")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatLoader;
