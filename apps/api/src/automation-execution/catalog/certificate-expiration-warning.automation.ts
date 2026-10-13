import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const certificateExpirationWarningAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRATION_WARNING,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Certificate expiration warning",
    [SUPPORTED_LANGUAGES.PL]: "Ostrzeżenie o wygaśnięciu certyfikatu",
    [SUPPORTED_LANGUAGES.DE]: "Warnung vor Zertifikatsablauf",
    [SUPPORTED_LANGUAGES.FR]: "Avertissement d’expiration du certificat",
    [SUPPORTED_LANGUAGES.ES]: "Aviso de vencimiento del certificado",
    [SUPPORTED_LANGUAGES.CS]: "Upozornění na vypršení certifikátu",
    [SUPPORTED_LANGUAGES.LT]: "Įspėjimas apie sertifikato galiojimo pabaigą",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent before a learner's certificate expires.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane przed wygaśnięciem certyfikatu uczestnika.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, bevor das Zertifikat eines Lernenden abläuft.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée avant l’expiration du certificat d’un apprenant.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía antes de que venza el certificado de un participante.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se před vypršením platnosti certifikátu účastníka.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama prieš pasibaigiant besimokančiojo sertifikato galiojimui.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.CERTIFICATE_EXPIRATION_WARNING,
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
    expires_at: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "expires_at" },
  },
};
