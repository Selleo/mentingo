import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

import type { ChangeEvent } from "react";

interface LessonFormProps {
  handleSubmit: () => void;
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => void;
}

export const LessonForm = ({ handleSubmit, input, handleInputChange }: LessonFormProps) => {
  const { t } = useTranslation();

  return (
    <div className="mt-8 w-full">
      <form onSubmit={handleSubmit}>
        <div className="flex w-full flex-col gap-y-4 rounded-2xl border border-[#E4E6EB] bg-[#F5F6F7] px-6 py-4">
          <div className="flex w-full items-end">
            <div className="flex grow flex-col">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder={t("studentCourseView.lesson.aiMentorLesson.sendMessage")}
                className="w-full border-none bg-transparent py-2 text-base font-normal text-gray-500 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50"
              />
              <div className="mt-5 flex items-center gap-x-2">
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full border-none bg-white shadow-sm disabled:opacity-50"
                >
                  <Icon name="Plus" className="size-5 text-gray-700" />
                </button>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full border-none bg-white shadow-sm disabled:opacity-50"
                >
                  <Icon name="Smile" className="size-5 text-gray-700" />
                </button>
              </div>
            </div>
            <div className="ml-4 flex-shrink-0">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!input.trim()}
                className="flex items-center gap-x-2 rounded-full px-5 py-2 font-semibold text-white disabled:opacity-50"
              >
                <Icon name="Send" className="size-5" />
                {t("studentCourseView.lesson.aiMentorLesson.send")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
