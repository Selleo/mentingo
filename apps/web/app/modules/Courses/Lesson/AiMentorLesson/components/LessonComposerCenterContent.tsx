import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

import { VoiceLevelBars } from "~/modules/Voice/components/VoiceLevelBars";

import type { ChangeEvent } from "react";

type LessonComposerCenterContentProps = {
  isVoiceMode: boolean;
  input: string;
  placeholder: string;
  voiceLevel: number;
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  textInputTestId?: string;
};

export function LessonComposerCenterContent({
  isVoiceMode,
  input,
  placeholder,
  voiceLevel,
  onInputChange,
  onSubmit,
  textInputTestId,
}: LessonComposerCenterContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (isVoiceMode) return;

    const el = textareaRef.current;
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
  }, [input, isVoiceMode]);

  return (
    <div className="flex w-full flex-col min-w-0">
      <AnimatePresence initial={false} mode="wait">
        {isVoiceMode ? (
          <motion.div
            key="voice-content"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex h-16 items-center justify-center"
          >
            <VoiceLevelBars voiceLevel={voiceLevel} />
          </motion.div>
        ) : (
          <motion.textarea
            key="text-content"
            ref={textareaRef}
            data-testid={textInputTestId}
            value={input}
            onChange={onInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full border-none bg-transparent py-2 text-base font-normal max-w-full overflow-x-hidden resize-none max-h-48 h-auto text-gray-500 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
