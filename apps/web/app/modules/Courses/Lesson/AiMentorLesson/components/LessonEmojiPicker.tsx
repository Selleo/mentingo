import { EmojiPicker } from "frimousse";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

interface Props {
  setInput: (value: string) => void;
  input: string;
}

export function LessonEmojiPicker({ setInput, input }: Props) {
  const { t } = useTranslation();
  return (
    <EmojiPicker.Root
      className="isolate flex h-[368px] w-fit flex-col bg-white dark:bg-neutral-900"
      onEmojiSelect={({ emoji }) => setInput(input + emoji)}
    >
      <EmojiPicker.Search
        className="z-10 mx-2 mt-2 appearance-none rounded-md bg-neutral-100 px-2.5 py-2 text-sm dark:bg-neutral-800 focus:outline-primary"
        placeholder={t("adminCourseView.curriculum.lesson.other.emoji.search")}
      />

      <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm dark:text-neutral-500">
          {t("adminCourseView.curriculum.lesson.other.emoji.loading")}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm dark:text-neutral-500"></EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1.5"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className="bg-white px-3 pt-3 pb-1.5 font-medium text-neutral-600 text-xs dark:bg-neutral-900 dark:text-neutral-400"
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1.5 px-1.5" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <Button
                className="flex size-8 items-center justify-center rounded-md text-lg"
                variant="ghost"
                type="button"
                {...props}
              >
                {emoji.emoji}
              </Button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
