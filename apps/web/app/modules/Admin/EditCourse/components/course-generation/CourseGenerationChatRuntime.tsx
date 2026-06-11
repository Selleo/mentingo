import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo } from "react";

import { CourseGenerationDrawer } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationDrawer";
import {
  getCurrentMessageKey,
  hasCourseGeneratedFlag,
} from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationChat.utils";
import { getCourseGenerationPreviewChapters } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationCourseCache.utils";
import { useCourseGenerationChat } from "~/modules/Admin/EditCourse/hooks/useCourseGenerationChat";

import type { GetCourseGenerationDraftResponse } from "~/api/generated-api";
import type { Chapter } from "~/modules/Admin/EditCourse/EditCourse.types";

type CourseGenerationChatRuntimeProps = {
  draft?: GetCourseGenerationDraftResponse;
  shouldRenderDrawer: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackgroundGenerationStateChange?: (isBackgroundGenerating: boolean) => void;
  onInvalidate?: () => void;
  onPreviewChaptersChange?: (chapters: Chapter[]) => void;
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
  onInvalidate,
  onPreviewChaptersChange,
  onProcessingStateChange,
}: CourseGenerationChatRuntimeProps) {
  const courseId = draft?.integrationId ?? "";
  const generationChat = useCourseGenerationChat({
    courseId,
    draftId: draft?.draftId,
    onInvalidate,
  });

  const currentMessageKey = getCurrentMessageKey(generationChat.data);
  const hasGenerated = hasCourseGeneratedFlag(generationChat.data);
  const previewChapters = useMemo(
    () => getCourseGenerationPreviewChapters(generationChat.data),
    [generationChat.data],
  );
  const isProcessing =
    (generationChat.status === "submitted" || generationChat.status === "streaming") &&
    !hasGenerated;

  useEffect(() => {
    onPreviewChaptersChange?.(previewChapters);
  }, [onPreviewChaptersChange, previewChapters]);

  useEffect(() => {
    onProcessingStateChange?.({ currentMessageKey, isProcessing });
  }, [currentMessageKey, isProcessing, onProcessingStateChange]);

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
    setInput: generationChat.setInput,
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
