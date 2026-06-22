export const LESSON_COMPOSER_PRIMARY_ACTION_MODE = {
  SEND: "send",
  STOP: "stop",
  VOICE: "voice",
} as const;

export type LessonComposerPrimaryActionMode =
  (typeof LESSON_COMPOSER_PRIMARY_ACTION_MODE)[keyof typeof LESSON_COMPOSER_PRIMARY_ACTION_MODE];

export type LessonComposerRightControlsProps = {
  isVoiceMode: boolean;
  isVoiceMentorMode: boolean;
  canSubmit: boolean;
  canUseVoiceMentor: boolean;
  onStartVoiceMode: () => void;
  onStopVoiceMode: () => void;
  onStartVoiceMentor: () => void;
  onStopVoiceMentor: () => void;
  onSubmit: () => void;
  sendLabel: string;
  toggleVoiceInputLabel: string;
  dictateVoiceInputLabel: string;
  startVoiceMentorLabel: string;
  stopVoiceRecordingLabel: string;
  primaryActionTestId?: string;
  micButtonTestId?: string;
};

export type LessonComposerPrimaryAction = {
  ariaLabel: string;
  disabled: boolean;
  label: string;
  mode: LessonComposerPrimaryActionMode;
  showText: boolean;
};
