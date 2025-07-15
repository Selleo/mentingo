import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";

const ChatLoader = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-x-3">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
        <Icon name="AiMentor" className="size-5 text-blue-600" />
      </div>
      <div className="flex max-w-[80%] flex-col">
        <span className="mb-1 text-sm font-semibold text-blue-900">
          {t("studentCourseView.lesson.aiMentorLesson.aiMentorName")}
        </span>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex animate-pulse space-x-1">
            <div className="size-2 animate-bounce rounded-full bg-gray-400"></div>
            <div
              className="size-2 animate-bounce rounded-full bg-gray-400"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="size-2 animate-bounce rounded-full bg-gray-400"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
          <span>{t("studentCourseView.lesson.aiMentorLesson.typing")}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatLoader;
