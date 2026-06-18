import { ANNOUNCEMENT_EMAIL_TEMPLATES } from "@repo/shared";

import type { AnnouncementEmailTemplate, SupportedLanguages } from "@repo/shared";

export const LIVE_TRAINING_REMINDER_OFFSET_MINUTES = 15;

export const LIVE_TRAINING_ANNOUNCEMENT_TITLES = {
  [ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_REMINDER]: {
    en: "Live Training starts soon",
    pl: "Szkolenie na żywo rozpocznie się wkrótce",
    de: "Live-Schulung beginnt bald",
    lt: "Tiesioginiai mokymai netrukus prasidės",
    cs: "Živé školení brzy začne",
  },
  [ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_STARTED]: {
    en: "Live Training has started",
    pl: "Szkolenie na żywo rozpoczęło się",
    de: "Live-Schulung hat begonnen",
    lt: "Tiesioginiai mokymai prasidėjo",
    cs: "Živé školení začalo",
  },
  [ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_ENDED]: {
    en: "Live Training has ended",
    pl: "Szkolenie na żywo zakończyło się",
    de: "Live-Schulung wurde beendet",
    lt: "Tiesioginiai mokymai baigėsi",
    cs: "Živé školení skončilo",
  },
  [ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT]: {
    en: "Announcement",
    pl: "Ogłoszenie",
    de: "Ankündigung",
    lt: "Pranešimas",
    cs: "Oznámení",
  },
} satisfies Record<AnnouncementEmailTemplate, Record<SupportedLanguages, string>>;
