import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

import { VoiceLevelBars } from "~/modules/Voice/components/VoiceLevelBars";

type CourseGenerationComposerCenterContentProps = {
  isVoiceMode: boolean;
  input: string;
  currentPlaceholder: string;
  voiceLevel: number;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
};

export function CourseGenerationComposerCenterContent({
  isVoiceMode,
  input,
  currentPlaceholder,
  voiceLevel,
  onInputChange,
  onSubmit,
}: CourseGenerationComposerCenterContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const layoutTransition = {
    duration: 0.24,
    ease: "easeInOut" as const,
  };

  useLayoutEffect(() => {
    if (isVoiceMode) return;

    const el = textareaRef.current;
    if (!el) return;

    const resize = () => {
      el.style.height = "auto";
      const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight) || 20;
      const maxHeight = lineHeight * 4;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    resize();
    el.addEventListener("input", resize);

    return () => {
      el.removeEventListener("input", resize);
    };
  }, [input, isVoiceMode]);

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className="relative min-w-0"
    >
      <AnimatePresence initial={false} mode="wait">
        {isVoiceMode ? (
          <motion.div
            layout
            key="center-voice"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={layoutTransition}
            className="flex min-h-8 items-center justify-center py-1"
          >
            <VoiceLevelBars voiceLevel={voiceLevel} />
          </motion.div>
        ) : (
          <motion.div
            layout
            key="center-text"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={layoutTransition}
            className="relative"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              className="min-h-8 w-full resize-none overflow-x-hidden border-none bg-transparent py-1 text-sm leading-6 text-neutral-950 shadow-none focus:outline-none focus:ring-0"
            />

            {!input.trim() && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden py-1">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentPlaceholder}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="block w-full overflow-hidden whitespace-pre-wrap break-words text-sm leading-6 text-neutral-500"
                  >
                    {currentPlaceholder.split("").map((char, index) => (
                      <motion.span
                        key={`${char}-${index}`}
                        initial={{ opacity: 0, x: -2 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: index * 0.018 }}
                      >
                        {char}
                      </motion.span>
                    ))}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
