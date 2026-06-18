import { match } from "ts-pattern";

import {
  LESSON_COMPOSER_PRIMARY_ACTION_MODE,
  type LessonComposerPrimaryAction,
  type LessonComposerRightControlsProps,
} from "./LessonComposerRightControls.types";

type ResolvePrimaryActionParams = Pick<
  LessonComposerRightControlsProps,
  | "canSubmit"
  | "canUseVoiceMentor"
  | "isVoiceMentorMode"
  | "isVoiceMode"
  | "sendLabel"
  | "startVoiceMentorLabel"
  | "stopVoiceRecordingLabel"
>;

export const resolveLessonComposerPrimaryAction = ({
  canSubmit,
  canUseVoiceMentor,
  isVoiceMentorMode,
  isVoiceMode,
  sendLabel,
  startVoiceMentorLabel,
  stopVoiceRecordingLabel,
}: ResolvePrimaryActionParams): LessonComposerPrimaryAction =>
  match({ canSubmit, canUseVoiceMentor, isVoiceMentorMode, isVoiceMode })
    .with({ isVoiceMode: true }, () => ({
      ariaLabel: stopVoiceRecordingLabel,
      disabled: false,
      label: stopVoiceRecordingLabel,
      mode: LESSON_COMPOSER_PRIMARY_ACTION_MODE.STOP,
      showText: false,
    }))
    .with({ isVoiceMentorMode: true }, () => ({
      ariaLabel: stopVoiceRecordingLabel,
      disabled: false,
      label: stopVoiceRecordingLabel,
      mode: LESSON_COMPOSER_PRIMARY_ACTION_MODE.STOP,
      showText: false,
    }))
    .with({ canUseVoiceMentor: true, canSubmit: false }, () => ({
      ariaLabel: startVoiceMentorLabel,
      disabled: false,
      label: startVoiceMentorLabel,
      mode: LESSON_COMPOSER_PRIMARY_ACTION_MODE.VOICE,
      showText: false,
    }))
    .otherwise(() => ({
      ariaLabel: sendLabel,
      disabled: !canSubmit,
      label: sendLabel,
      mode: LESSON_COMPOSER_PRIMARY_ACTION_MODE.SEND,
      showText: canSubmit,
    }));
