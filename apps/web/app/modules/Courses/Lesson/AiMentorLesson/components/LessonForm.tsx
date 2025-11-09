import { useRef, useLayoutEffect } from "react";
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

  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    resize();

    el.addEventListener("input", resize);

    return () => {
      el.removeEventListener("input", resize);
    };
  }, [ref.current?.value, handleSubmit]);

  return (
    <div className="mt-8 w-full">
      <form onSubmit={handleSubmit}>
        <div className="flex w-full flex-col gap-y-4 rounded-2xl border border-[#E4E6EB] bg-[#F5F6F7] px-6 py-4">
          <div className="flex w-full items-end">
            <div className="flex grow flex-col max-h-64">
              <textarea
                ref={ref}
                value={input}
                onChange={handleInputChange}
                placeholder={t("studentCourseView.lesson.aiMentorLesson.sendMessage")}
                className="w-full border-none bg-transparent py-2 text-base font-normal max-w-full overflow-x-hidden resize-none max-h-48 h-auto text-gray-500 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50"
              />
              <div className="flex items-center justify-between">
                <div className="mt-5 flex items-center gap-x-2">
                  <Button className="flex size-8 items-center justify-center rounded-full border-none bg-white p-0 shadow-sm disabled:opacity-50">
                    <Icon name="Plus" className="size-5 text-gray-700" />
                  </Button>
                  <Button className="flex size-8 items-center justify-center rounded-full border-none bg-white p-0 shadow-sm disabled:opacity-50">
                    <Icon name="Smile" className="size-5 text-gray-700" />
                  </Button>
                </div>
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
        </div>
      </form>
    </div>
  );
};
