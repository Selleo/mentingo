import { AnimatePresence, motion } from "motion/react";

import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
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
              value={input}
              maxRows={5}
              onChange={onInputChange}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder={placeholder}
              className="h-auto min-h-0 w-full max-w-full overflow-x-hidden border-none bg-transparent px-0 py-1.5 text-base font-normal text-gray-600 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
