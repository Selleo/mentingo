import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const contentMarketplaceCourseUpdateAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.CONTENT_MARKETPLACE_COURSE_UPDATE,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Marketplace course update",
    [SUPPORTED_LANGUAGES.PL]: "Aktualizacja kursu z marketplace",
    [SUPPORTED_LANGUAGES.DE]: "Kursaktualisierung im Marketplace",
    [SUPPORTED_LANGUAGES.FR]: "Mise à jour de cours du marketplace",
    [SUPPORTED_LANGUAGES.ES]: "Actualización de curso del marketplace",
    [SUPPORTED_LANGUAGES.CS]: "Aktualizace kurzu z marketplace",
    [SUPPORTED_LANGUAGES.LT]: "Kurso atnaujinimas marketplace",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]:
      "Sent to administrators once per daily check, listing the courses added from the content marketplace that have a new version.",
    [SUPPORTED_LANGUAGES.PL]:
      "Wysyłane jednorazowo do administratorów, gdy marketplace opublikuje nową wersję kursu dodanego przez organizację.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird einmalig an Administratoren gesendet, wenn der Marketplace eine neue Version eines Kurses veröffentlicht, den die Organisation von dort hinzugefügt hat.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée une fois aux administrateurs lorsque le marketplace publie une nouvelle version d'un cours que l'organisation y a ajouté.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía una vez a los administradores cuando el marketplace publica una nueva versión de un curso que la organización añadió desde allí.",
    [SUPPORTED_LANGUAGES.CS]:
      "Odesílá se jednou správcům, když marketplace zveřejní novou verzi kurzu, který organizace odtud přidala.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama vieną kartą administratoriams, kai marketplace paskelbia naują kurso, kurį organizacija iš ten pridėjo, versiją.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.CONTENT_MARKETPLACE_COURSE_UPDATE,
  mappings: {
    courses_with_new_version: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "courses_with_new_version",
    },
    all_courses_with_new_version: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "all_courses_with_new_version",
    },
    courses_with_new_version_count: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "courses_with_new_version_count",
    },
    marketplace_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "marketplace_link" },
  },
};
