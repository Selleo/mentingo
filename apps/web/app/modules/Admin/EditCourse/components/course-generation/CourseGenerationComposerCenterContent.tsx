import { AnimatePresence, motion } from "motion/react";

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
  return (
    <div className="relative h-8 min-w-0 overflow-hidden">
      <AnimatePresence initial={false} mode="wait">
        {isVoiceMode ? (
          <motion.div
            key="center-voice"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: -2 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex h-8 items-center justify-center"
          >
            <VoiceLevelBars voiceLevel={voiceLevel} />
          </motion.div>
        ) : (
          <motion.div
            key="center-text"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative h-8"
          >
            <input
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              className="h-8 w-full border-none bg-transparent text-sm text-neutral-950 focus:outline-none"
            />

            {!input.trim() && (
              <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentPlaceholder}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-neutral-500"
                  >
                    {currentPlaceholder.split("").map((char, index) => (
                      <motion.span
                        key={`${char}-${index}`}
                        initial={{ opacity: 0, x: -2 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: index * 0.018 }}
                      >
                        {char === " " ? "\u00A0" : char}
                      </motion.span>
                    ))}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
