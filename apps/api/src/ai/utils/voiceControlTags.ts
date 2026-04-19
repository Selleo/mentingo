const XML_VOICE_CONTROL_TAG_REGEX = /<(emotion|break)\b(?:"[^"]*"|'[^']*'|[^'">])*\/>/gi;
const SPELL_TAG_REGEX = /<spell>(.*?)<\/spell>/gis;
const LAUGHTER_TAG_REGEX = /\[laughter]/gi;

export function stripVoiceControlTags(text: string): string {
  if (!text) {
    return text;
  }

  return text
    .replace(XML_VOICE_CONTROL_TAG_REGEX, " ")
    .replace(SPELL_TAG_REGEX, "$1")
    .replace(LAUGHTER_TAG_REGEX, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *([,.;!?])/g, "$1")
    .replace(/ *\n */g, "\n")
    .trim();
}
