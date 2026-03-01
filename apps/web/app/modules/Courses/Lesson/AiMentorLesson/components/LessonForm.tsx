import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { LessonComposerCenterContent } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonComposerCenterContent";
import { LessonComposerLeftControl } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonComposerLeftControl";
import { LessonComposerRightControls } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonComposerRightControls";
import { LessonEmojiPicker } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonEmojiPicker";
import { useTranscription } from "~/modules/Voice/hooks/useTranscription";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";

interface LessonFormProps {
  handleSubmit: () => void;
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => void;
  setInput: Dispatch<SetStateAction<string>>;
}

export const LessonForm = ({
  handleSubmit,
  input,
  handleInputChange,
  setInput,
}: LessonFormProps) => {
  const { t } = useTranslation();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);

  const emojiRef = useRef<HTMLDivElement | null>(null);
  const toggleEmojiPicker = () => setShowEmojiPicker((prev) => !prev);

  const { startRecording, stopRecording, cancelTranscription } = useTranscription({
    setInput,
    onLevelChange: setVoiceLevel,
  });

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const startVoiceMode = async () => {
    setShowEmojiPicker(false);
    const hasStarted = await startRecording();
    if (!hasStarted) return;
    setIsVoiceMode(true);
  };

  const stopVoiceMode = async () => {
    await stopRecording();
    setIsVoiceMode(false);
    setVoiceLevel(0);
  };

  const cancelVoiceMode = async () => {
    await cancelTranscription();
    setIsVoiceMode(false);
    setVoiceLevel(0);
  };

  return (
    <div className="mt-8 w-full relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isVoiceMode) {
            void stopVoiceMode();
            return;
          }
          handleSubmit();
        }}
      >
        <div className="flex w-full flex-col rounded-2xl border border-[#E4E6EB] bg-[#F5F6F7] px-6 py-4">
          <div>
            <LessonComposerCenterContent
              isVoiceMode={isVoiceMode}
              input={input}
              placeholder={t("studentCourseView.lesson.aiMentorLesson.sendMessage")}
              voiceLevel={voiceLevel}
              onInputChange={handleInputChange as (e: ChangeEvent<HTMLTextAreaElement>) => void}
              onSubmit={handleSubmit}
            />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LessonComposerLeftControl
                isVoiceMode={isVoiceMode}
                onCloseVoiceMode={() => void cancelVoiceMode()}
                onToggleEmojiPicker={toggleEmojiPicker}
                closeVoiceModeLabel={t("studentCourseView.lesson.aiMentorLesson.closeVoiceMode")}
                addEmojiLabel={t("studentCourseView.lesson.aiMentorLesson.addEmoji")}
              />
            </div>
            <LessonComposerRightControls
              isVoiceMode={isVoiceMode}
              canSubmit={Boolean(input.trim())}
              onStartVoiceMode={() => void startVoiceMode()}
              onStopVoiceMode={() => void stopVoiceMode()}
              onSubmit={handleSubmit}
              sendLabel={t("studentCourseView.lesson.aiMentorLesson.send")}
              toggleVoiceInputLabel={t("studentCourseView.lesson.aiMentorLesson.toggleVoiceInput")}
              stopVoiceRecordingLabel={t(
                "studentCourseView.lesson.aiMentorLesson.stopVoiceRecording",
              )}
            />
          </div>

          {showEmojiPicker && !isVoiceMode && (
            <div className="absolute bottom-16 left-0" ref={emojiRef}>
              <LessonEmojiPicker setInput={setInput} input={input} />
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
