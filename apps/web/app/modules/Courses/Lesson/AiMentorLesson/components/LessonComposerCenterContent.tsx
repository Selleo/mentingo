import { AnimatePresence, motion } from "motion/react";

import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { cn } from "~/lib/utils";
import { VoiceLevelBars } from "~/modules/Voice/components/VoiceLevelBars";

import type { ChangeEvent } from "react";

type LessonComposerCenterContentProps = {
  isVoiceMode: boolean;
  input: string;
  placeholder: string;
  voiceLevel: number;
  compact?: boolean;
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  textInputTestId?: string;
  ariaLabel?: string;
};

export function LessonComposerCenterContent({
  isVoiceMode,
  input,
  placeholder,
  voiceLevel,
  compact = false,
  onInputChange,
  onSubmit,
  textInputTestId,
  ariaLabel,
}: LessonComposerCenterContentProps) {
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
          <motion.div
            key="text-content"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full min-w-0"
          >
            <AutosizeTextarea
              data-testid={textInputTestId}
              aria-label={ariaLabel}
              value={input}
              minRows={compact ? 1 : 2}
              maxRows={compact ? 3 : 5}
              onChange={onInputChange}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder={placeholder}
              className={cn(
                "h-auto w-full max-w-full overflow-x-hidden border-none bg-transparent px-0 py-1.5 text-base font-normal text-gray-600 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50",
                compact && "min-h-[2.25rem] py-1 text-sm",
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
