import type { SupportedLanguages } from "../constants/languages";

export type LocalizedText = Partial<Record<SupportedLanguages, string>>;
