import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCourseGenerationFile } from "~/api/mutations/admin/useDeleteCourseGenerationFile";
import { useCourseGenerationFiles } from "~/api/queries/admin/useCourseGenerationFiles";
import { Icon } from "~/components/Icon";
import { CourseGenerationComposer } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationComposer";
import { CourseGenerationAiTypingMessage } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationMessages";
import {
  getCurrentMessageKey,
  getMessageText,
} from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationChat.utils";
import { UploadFileCard } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/components/UploadFileCard";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";

import { COURSE_GENERATION_HANDLES } from "../../../../../../e2e/data/curriculum/handles";

type CourseGenerationMessage = {
  id: string;
  role: string;
  content: unknown;
};

type CourseGenerationChatPanelProps = {
  courseId: string;
  messages: CourseGenerationMessage[];
  streamData: unknown;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  setInput: Dispatch<SetStateAction<string>>;
  isProcessing: boolean;
  onMessageCountChange: (count: number) => void;
  onClose: () => void;
  onGenerationStarted?: () => void;
};

export function CourseGenerationChatPanel({
  courseId,
  messages,
  streamData,
  input,
  onInputChange,
  onSubmit,
  isProcessing,
  onMessageCountChange,
  onClose,
  setInput,
  onGenerationStarted,
}: CourseGenerationChatPanelProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const generationStartedRef = useRef(false);
  const { data: ingestedFiles = [] } = useCourseGenerationFiles(courseId, !!courseId);
  const { mutateAsync: deleteFile, isPending: isDeletePending } = useDeleteCourseGenerationFile();

  useEffect(() => {
    onMessageCountChange(messages.length);
  }, [messages.length, onMessageCountChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (generationStartedRef.current) return;
    if (getCurrentMessageKey(streamData) !== "DESIGNING_CHAPTERS") return;
    generationStartedRef.current = true;
    onGenerationStarted?.();
  }, [streamData, onGenerationStarted]);

  const currentMessageKey = getCurrentMessageKey(streamData);

  const renderedMessages = useMemo(
    () =>
      messages
        .map((message) => ({
          id: message.id,
          role: message.role,
          text: getMessageText(message.content).trim(),
        }))
        .filter((message) => message.text.length > 0)
        .map((message) => (
          <ChatMessage
            key={message.id}
            id={message.id}
            role={message.role as "user" | "assistant"}
            content={message.text}
            aiName={t("adminCourseView.common.aiCourseCreation")}
            messageMaxWidthClass="max-w-[80%]"
          />
        )),
    [messages, t],
  );

  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistantText =
    lastMessage?.role === "assistant" && getMessageText(lastMessage.content).trim().length > 0;
  const showTypingLoader = isProcessing && !hasStreamingAssistantText;
  const showThinkingLabel =
    Boolean(currentMessageKey) && isProcessing && !hasStreamingAssistantText;
  const thinkingLabel = t(`adminCourseView.thinking.${currentMessageKey ?? "THINKING"}`);
  const aiCourseCreationLabel = t("adminCourseView.common.aiCourseCreation");

  const handleRemoveFile = async (documentId: string) => {
    if (!courseId) return;
    await deleteFile({ integrationId: courseId, documentId });
  };

  const getFileTypeLabel = (contentType: string) => {
    if (contentType.includes("pdf")) return "PDF document";
    if (contentType.includes("wordprocessingml")) return "DOCX document";
    if (contentType.includes("markdown")) return "Markdown file";
    if (contentType.includes("text")) return "Text file";
    return contentType || "File";
  };

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-16 items-center justify-between border-b border-neutral-200 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-neutral-900">
          <div className="flex items-center gap-2">
            <Icon name="AiMentor" className="size-4 text-primary-600" />
            <span className="text-base font-semibold tracking-tight text-black">
              {aiCourseCreationLabel}
            </span>
          </div>

          {ingestedFiles.length > 0 && (
            <>
              <div className="h-5 w-px bg-neutral-200" />
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max items-center gap-2 pr-3">
                  {ingestedFiles.map((file) => (
                    <div key={file.id} className="w-56 shrink-0">
                      <UploadFileCard
                        name={file.filename}
                        meta={getFileTypeLabel(file.contentType)}
                        onRemove={() => void handleRemoveFile(file.id)}
                        compact
                        removeDisabled={isDeletePending}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              data-testid={COURSE_GENERATION_HANDLES.CLOSE_BUTTON}
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="inline-flex items-center justify-center rounded-full p-2.5 text-black transition hover:bg-neutral-200"
            >
              <Icon name="X" className="size-3" />
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto w-full max-w-[80%] space-y-5">
          {renderedMessages}
          {showTypingLoader && (
            <CourseGenerationAiTypingMessage
              aiLabel={aiCourseCreationLabel}
              thinkingLabel={showThinkingLabel ? thinkingLabel : null}
            />
          )}
        </div>
      </div>

      <div className="border-t border-neutral-200 px-5 py-4">
        <div className="mx-auto w-full max-w-[80%]">
          <CourseGenerationComposer
            setInput={setInput}
            input={input}
            integrationId={courseId}
            onInputChange={onInputChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}
