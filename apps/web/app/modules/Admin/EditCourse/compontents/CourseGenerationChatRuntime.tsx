import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

import {
  getCurrentMessageKey,
  hasCourseGeneratedFlag,
} from "~/modules/Admin/EditCourse/compontents/courseGenerationChat.utils";
import { CourseGenerationDrawer } from "~/modules/Admin/EditCourse/compontents/CourseGenerationDrawer";
import { useCourseGenerationChat } from "~/modules/Admin/EditCourse/hooks/useCourseGenerationChat";

import type { GetCourseGenerationDraftResponse } from "~/api/generated-api";

type CourseGenerationChatRuntimeProps = {
  draft?: GetCourseGenerationDraftResponse;
  shouldRenderDrawer: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackgroundGenerationStateChange?: (isBackgroundGenerating: boolean) => void;
  onGenerationFinished?: () => void;
  onProcessingStateChange?: (state: {
    currentMessageKey: string | null;
    isProcessing: boolean;
  }) => void;
};

export function CourseGenerationChatRuntime({
  draft,
  shouldRenderDrawer,
  open,
  onOpenChange,
  onBackgroundGenerationStateChange,
  onGenerationFinished,
  onProcessingStateChange,
}: CourseGenerationChatRuntimeProps) {
  const courseId = draft?.integrationId ?? "";
  const hasFinishedRef = useRef(false);
  const generationChat = useCourseGenerationChat({
    courseId,
    draftId: draft?.draftId,
  });

  const currentMessageKey = getCurrentMessageKey(generationChat.data);
  const hasGenerated = hasCourseGeneratedFlag(generationChat.data);
  const isProcessing =
    (generationChat.status === "submitted" || generationChat.status === "streaming") &&
    !hasGenerated;

  useEffect(() => {
    onProcessingStateChange?.({ currentMessageKey, isProcessing });
  }, [currentMessageKey, isProcessing, onProcessingStateChange]);

  useEffect(() => {
    if (!hasGenerated || hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    onGenerationFinished?.();
  }, [hasGenerated, onGenerationFinished]);

  const chat = {
    messages: generationChat.messages.map((message) => ({
      id: message.id,
      role: String(message.role),
      content: message.content,
    })),
    streamData: generationChat.data,
    input: generationChat.input,
    onInputChange: generationChat.setInput,
    onSubmit: () => generationChat.handleSubmit(),
    isProcessing,
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {shouldRenderDrawer && (
        <motion.div
          key="course-generation-drawer"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <CourseGenerationDrawer
            draft={draft}
            chat={chat}
            open={open}
            onOpenChange={onOpenChange}
            onBackgroundGenerationStateChange={onBackgroundGenerationStateChange}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
