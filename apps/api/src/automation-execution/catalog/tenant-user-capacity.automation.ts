import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const tenantUserCapacityAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.TENANT_USER_CAPACITY,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "User capacity alert",
    [SUPPORTED_LANGUAGES.PL]: "Alert o limicie użytkowników",
    [SUPPORTED_LANGUAGES.DE]: "Warnung zur Benutzerkapazität",
    [SUPPORTED_LANGUAGES.FR]: "Alerte de capacité d'utilisateurs",
    [SUPPORTED_LANGUAGES.ES]: "Alerta de capacidad de usuarios",
    [SUPPORTED_LANGUAGES.CS]: "Upozornění na kapacitu uživatelů",
    [SUPPORTED_LANGUAGES.LT]: "Įspėjimas apie naudotojų talpą",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]:
      "Sent to administrators when the organization approaches its user limit, reaches it, or runs out of user slots.",
    [SUPPORTED_LANGUAGES.PL]:
      "Wysyłane do administratorów, gdy organizacja zbliża się do limitu użytkowników, osiąga go lub wykorzysta wszystkie miejsca.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird an Administratoren gesendet, wenn sich die Organisation ihrem Benutzerlimit nähert, es erreicht oder keine Benutzerplätze mehr frei sind.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée aux administrateurs lorsque l'organisation approche de sa limite d'utilisateurs, l'atteint ou n'a plus de places libres.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía a los administradores cuando la organización se acerca a su límite de usuarios, lo alcanza o se queda sin plazas.",
    [SUPPORTED_LANGUAGES.CS]:
      "Odesílá se správcům, když se organizace blíží limitu uživatelů, dosáhne ho nebo jí dojdou místa pro uživatele.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama administratoriams, kai organizacija artėja prie naudotojų limito, jį pasiekia arba nebelieka laisvų vietų.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.TENANT_USER_CAPACITY,
  mappings: {
    capacity_title: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "capacity_title" },
    capacity_message: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "capacity_message" },
    active_users_count: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "active_users_count" },
    max_users: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "max_users" },
    allowed_users_count: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "allowed_users_count",
    },
    users_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "users_link" },
  },
};
