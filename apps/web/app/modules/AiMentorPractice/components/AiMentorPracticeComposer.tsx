import { ClipboardCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { LessonForm } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonForm";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../../e2e/data/ai-mentor-practice/handles";

import type { UIMessage } from "@ai-sdk/react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";

type AiMentorPracticeComposerProps = {
  lessonId: string;
  mentorName: string;
  handleSubmit: () => void;
  onMentorTranscription: (text: string) => void;
  onMentorResponseCompleted: (text: string) => void;
  onAudioInterrupted: () => void;
  onAudioOutputCompleted: () => void;
  onJudge: () => Promise<void>;
  isJudgePending: boolean;
  handleInputChange: (
    event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  messages: UIMessage[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  hasTaskDescription: boolean;
  taskDescription: string;
  hasLearnerMessage: boolean;
  isProcessing: boolean;
};

export function AiMentorPracticeComposer({
  lessonId,
  mentorName,
  handleSubmit,
  onMentorTranscription,
  onMentorResponseCompleted,
  onAudioInterrupted,
  onAudioOutputCompleted,
  onJudge,
  isJudgePending,
  handleInputChange,
  messages,
  input,
  setInput,
  hasTaskDescription,
  taskDescription,
  hasLearnerMessage,
  isProcessing,
}: AiMentorPracticeComposerProps) {
  const { t } = useTranslation();

  return (
    <>
      <LessonForm
        lessonId={lessonId}
        mentorName={mentorName}
        handleSubmit={handleSubmit}
        onMentorTranscription={onMentorTranscription}
        onMentorResponseCompleted={onMentorResponseCompleted}
        onAudioInterrupted={onAudioInterrupted}
        onAudioOutputCompleted={onAudioOutputCompleted}
        onJudge={onJudge}
        isJudgePending={isJudgePending}
        handleInputChange={handleInputChange}
        messages={messages}
        input={input}
        setInput={setInput}
        hasTaskDescription={hasTaskDescription}
        taskDescription={taskDescription}
        allowVoiceMentor={false}
        compact
      />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="details text-neutral-500">
          {hasLearnerMessage ? t("aiMentorPractice.checkHint") : t("aiMentorPractice.startHint")}
        </p>
        <Button
          type="button"
          data-testid={AI_MENTOR_PRACTICE_HANDLES.CHECK_BUTTON}
          size="sm"
          className="shrink-0 gap-2 motion-safe:active:scale-[0.98] motion-reduce:transform-none"
          disabled={!hasLearnerMessage || isProcessing}
          onClick={() => void onJudge()}
        >
          {t("aiMentorPractice.checkPractice")}
          <ClipboardCheck className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}
