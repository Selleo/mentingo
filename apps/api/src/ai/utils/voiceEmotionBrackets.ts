const EMOTION_TAG_REGEX = /\[[^\[\]\r\n]+]/g;

export function stripVoiceEmotionBrackets(text: string): string {
  if (!text) {
    return text;
  }

  return text.replace(EMOTION_TAG_REGEX, "");
}
