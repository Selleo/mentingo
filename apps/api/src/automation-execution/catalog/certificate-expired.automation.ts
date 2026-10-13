import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const certificateExpiredAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRED,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Certificate expired",
    [SUPPORTED_LANGUAGES.PL]: "Certyfikat wygasł",
    [SUPPORTED_LANGUAGES.DE]: "Zertifikat abgelaufen",
    [SUPPORTED_LANGUAGES.FR]: "Certificat expiré",
    [SUPPORTED_LANGUAGES.ES]: "Certificado vencido",
    [SUPPORTED_LANGUAGES.CS]: "Platnost certifikátu vypršela",
    [SUPPORTED_LANGUAGES.LT]: "Sertifikato galiojimas pasibaigė",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner's certificate expires or is reset.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy certyfikat uczestnika wygasa lub zostaje zresetowany.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird gesendet, wenn das Zertifikat eines Lernenden abläuft oder zurückgesetzt wird.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée lorsque le certificat d’un apprenant expire ou est réinitialisé.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía cuando el certificado de un participante vence o se restablece.",
    [SUPPORTED_LANGUAGES.CS]:
      "Odesílá se, když platnost certifikátu účastníka vyprší nebo je certifikát resetován.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama, kai besimokančiojo sertifikato galiojimas pasibaigia arba sertifikatas nustatomas iš naujo.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.CERTIFICATE_MANUALLY_RESET,
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
    reason: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "reason" },
  },
};
