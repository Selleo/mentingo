import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { TypingDots } from "~/components/TypingDots";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

const ChatLoader = ({
  aiName,
  avatarUrl,
  status,
}: {
  aiName?: string | null;
  avatarUrl?: string;
  status?: string;
}) => {
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
        <span className="text-sm font-semibold text-primary-900 dark:text-primary-100">
          {displayName}
        </span>
        <div className="w-fit max-w-full text-sm text-neutral-800 dark:text-neutral-300">
          {status ? (
            <p role="status" aria-live="polite" className="flex items-center gap-2 leading-6">
              <LoaderCircle
                className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {status}
            </p>
          ) : (
            <TypingDots />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatLoader;
