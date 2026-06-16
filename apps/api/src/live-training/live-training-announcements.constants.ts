import { ANNOUNCEMENT_EMAIL_TEMPLATES } from "@repo/shared";

import type { AnnouncementEmailTemplate, SupportedLanguages } from "@repo/shared";

export const LIVE_TRAINING_REMINDER_OFFSET_MINUTES = 15;

export const LIVE_TRAINING_ANNOUNCEMENT_TITLES = {
  [ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_REMINDER]: {
    en: "Live Training starts soon",
    pl: "Szkolenie na żywo rozpocznie się wkrótce",
    de: "Live Training beginnt bald",
    lt: "Live Training netrukus prasidės",
    cs: "Live Training brzy začne",
  },
  [ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_STARTED]: {
    en: "Live Training has started",
    pl: "Szkolenie na żywo rozpoczęło się",
    de: "Live Training hat begonnen",
    lt: "Live Training prasidėjo",
    cs: "Live Training začal",
  },
  [ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_ENDED]: {
    en: "Live Training has ended",
    pl: "Szkolenie na żywo zakończyło się",
    de: "Live Training wurde beendet",
    lt: "Live Training baigėsi",
    cs: "Live Training skončil",
  },
  [ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT]: {
    en: "Announcement",
    pl: "Ogłoszenie",
    de: "Ankündigung",
    lt: "Pranešimas",
    cs: "Oznámení",
  },
} satisfies Record<AnnouncementEmailTemplate, Record<SupportedLanguages, string>>;
