import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import videojs from "video.js";
import cs from "video.js/dist/lang/cs.json";
import de from "video.js/dist/lang/de.json";
import es from "video.js/dist/lang/es.json";
import fr from "video.js/dist/lang/fr.json";
import pl from "video.js/dist/lang/pl.json";

// Video.js ships no Lithuanian dictionary, so "lt" falls back to the built-in English strings.
const VIDEO_JS_DICTIONARIES: Partial<Record<SupportedLanguages, Record<string, string>>> = {
  [SUPPORTED_LANGUAGES.CS]: cs,
  [SUPPORTED_LANGUAGES.DE]: de,
  [SUPPORTED_LANGUAGES.ES]: es,
  [SUPPORTED_LANGUAGES.FR]: fr,
  [SUPPORTED_LANGUAGES.PL]: pl,
};

/** Registers the Video.js dictionary for the UI language and returns the language code to pass to the player. */
export function registerVideoJsLanguage(language: string): string {
  const dictionary = isSupportedLanguage(language) ? VIDEO_JS_DICTIONARIES[language] : undefined;

  if (!dictionary) return SUPPORTED_LANGUAGES.EN;

  videojs.addLanguage(language, dictionary);

  return language;
}
