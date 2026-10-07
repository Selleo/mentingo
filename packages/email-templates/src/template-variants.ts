import {
  BUILT_IN_EMAIL_TEMPLATE_KEYS as KEYS,
  AUTOMATION_EVENT_KINDS as EVENTS,
  CERTIFICATE_ARCHIVE_REASONS,
  SUPPORTED_LANGUAGES,
  type BuiltInEmailTemplateKey,
  type AutomationPlaceholderType,
} from "@repo/shared";
import { EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT } from "./template-registry";
import { getUserAssignedToCourseEmailTranslations } from "./translations/userAssignedToCourse";
import { getUserFinishedCourseEmailTranslations } from "./translations/userFinishedCourse";
import { getCertificateExpiredEmailTranslations } from "./translations/certificateExpired";
import { getUserShortInactivityEmailTranslations } from "./translations/userShortInactivity";
import { getUserLongInactivityEmailTranslations } from "./translations/userLongInactivity";
import { getCourseDueDateReminderEmailTranslations } from "./translations/courseDueDateReminder";
import {
  buildNormalizedLocalizedSubjectTemplates,
  createDocumentFromEmailContent,
} from "./utils/templateRegistry";
import { deriveEmailTemplatePublicationUsage } from "./template-usage";
import type { PublishedEmailTemplate, EmailTemplateVariant } from "./publication.types";

const suffixes = {
  withDeadline: {
    en: "with deadline",
    pl: "z terminem",
    de: "mit Frist",
    fr: "avec échéance",
    es: "con fecha límite",
    cs: "s termínem",
    lt: "su terminu",
  },
  withoutDeadline: {
    en: "without deadline",
    pl: "bez terminu",
    de: "ohne Frist",
    fr: "sans échéance",
    es: "sin fecha límite",
    cs: "bez termínu",
    lt: "be termino",
  },
  withCertificate: {
    en: "with certificate",
    pl: "z certyfikatem",
    de: "mit Zertifikat",
    fr: "avec certificat",
    es: "con certificado",
    cs: "s certifikátem",
    lt: "su pažymėjimu",
  },
  withoutCertificate: {
    en: "without certificate",
    pl: "bez certyfikatu",
    de: "ohne Zertifikat",
    fr: "sans certificat",
    es: "sin certificado",
    cs: "bez certifikátu",
    lt: "be pažymėjimo",
  },
  reset: {
    en: "reset by administrator",
    pl: "reset przez administratora",
    de: "vom Administrator zurückgesetzt",
    fr: "réinitialisé par un administrateur",
    es: "restablecido por el administrador",
    cs: "resetováno správcem",
    lt: "nustatyta iš naujo administratoriaus",
  },
  expired: {
    en: "validity ended",
    pl: "koniec ważności",
    de: "Gültigkeit abgelaufen",
    fr: "validité expirée",
    es: "vigencia finalizada",
    cs: "platnost vypršela",
    lt: "galiojimas baigėsi",
  },
  course: {
    en: "course",
    pl: "kurs",
    de: "Kurs",
    fr: "cours",
    es: "curso",
    cs: "kurz",
    lt: "kursas",
  },
  platform: {
    en: "platform",
    pl: "platforma",
    de: "Plattform",
    fr: "plateforme",
    es: "plataforma",
    cs: "platforma",
    lt: "platforma",
  },
  today: {
    en: "due today",
    pl: "termin dzisiaj",
    de: "heute fällig",
    fr: "échéance aujourd’hui",
    es: "vence hoy",
    cs: "termín dnes",
    lt: "terminas šiandien",
  },
  tomorrow: {
    en: "due tomorrow",
    pl: "termin jutro",
    de: "morgen fällig",
    fr: "échéance demain",
    es: "vence mañana",
    cs: "termín zítra",
    lt: "terminas rytoj",
  },
  upcoming: {
    en: "upcoming deadline",
    pl: "nadchodzący termin",
    de: "bevorstehende Frist",
    fr: "échéance à venir",
    es: "próxima fecha límite",
    cs: "blížící se termín",
    lt: "artėjantis terminas",
  },
} as const;
const course = "{{ course_name }}";

export const EMAIL_TEMPLATE_VARIANTS: EmailTemplateVariant[] = [
  {
    key: KEYS.ASSIGNMENT_WITH_DEADLINE,
    event: EVENTS.USER_ASSIGNED_TO_COURSE,
    suffix: suffixes.withDeadline,
    button: "course_link",
    content: (language) =>
      getUserAssignedToCourseEmailTranslations(language, course, "{{ formatted_course_due_date }}"),
  },
  {
    key: KEYS.ASSIGNMENT_WITHOUT_DEADLINE,
    event: EVENTS.USER_ASSIGNED_TO_COURSE,
    suffix: suffixes.withoutDeadline,
    button: "course_link",
    content: (language) => getUserAssignedToCourseEmailTranslations(language, course, null),
  },
  {
    key: KEYS.COMPLETION_WITH_CERTIFICATE,
    event: EVENTS.USER_FINISHED_COURSE,
    suffix: suffixes.withCertificate,
    button: "certificate_link",
    content: (language) => getUserFinishedCourseEmailTranslations(language, course, true),
  },
  {
    key: KEYS.COMPLETION_WITHOUT_CERTIFICATE,
    event: EVENTS.USER_FINISHED_COURSE,
    suffix: suffixes.withoutCertificate,
    button: "courses_link",
    content: (language) => getUserFinishedCourseEmailTranslations(language, course, false),
  },
  {
    key: KEYS.CERTIFICATE_MANUALLY_RESET,
    event: EVENTS.CERTIFICATE_EXPIRED,
    suffix: suffixes.reset,
    button: "course_link",
    content: (language) =>
      getCertificateExpiredEmailTranslations(
        language,
        course,
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      ),
  },
  {
    key: KEYS.CERTIFICATE_NATURALLY_EXPIRED,
    event: EVENTS.CERTIFICATE_EXPIRED,
    suffix: suffixes.expired,
    button: "course_link",
    content: (language) =>
      getCertificateExpiredEmailTranslations(language, course, CERTIFICATE_ARCHIVE_REASONS.EXPIRED),
  },
  {
    key: KEYS.SHORT_INACTIVITY_COURSE,
    event: EVENTS.USER_SHORT_INACTIVITY,
    suffix: suffixes.course,
    button: "course_link",
    subject: "userShortInactivityEmail",
    content: (language) => getUserShortInactivityEmailTranslations(language, course),
  },
  {
    key: KEYS.SHORT_INACTIVITY_PLATFORM,
    event: EVENTS.USER_SHORT_INACTIVITY,
    suffix: suffixes.platform,
    button: "platform_link",
    subject: "userShortInactivityPlatformEmail",
    content: (language) => getUserShortInactivityEmailTranslations(language),
  },
  {
    key: KEYS.LONG_INACTIVITY_COURSE,
    event: EVENTS.USER_LONG_INACTIVITY,
    suffix: suffixes.course,
    button: "course_link",
    subject: "userLongInactivityEmail",
    content: (language) => getUserLongInactivityEmailTranslations(language, course),
  },
  {
    key: KEYS.LONG_INACTIVITY_PLATFORM,
    event: EVENTS.USER_LONG_INACTIVITY,
    suffix: suffixes.platform,
    button: "platform_link",
    subject: "userLongInactivityEmail",
    content: (language) => ({
      ...getUserLongInactivityEmailTranslations(language),
      heading: getUserShortInactivityEmailTranslations(language).heading,
      buttonText: getUserShortInactivityEmailTranslations(language).buttonText,
    }),
  },
  {
    key: KEYS.DEADLINE_TODAY,
    event: EVENTS.COURSE_DUE_DATE_REMINDER,
    suffix: suffixes.today,
    button: "course_link",
    content: (language) => getCourseDueDateReminderEmailTranslations(language, course, "", 0),
  },
  {
    key: KEYS.DEADLINE_TOMORROW,
    event: EVENTS.COURSE_DUE_DATE_REMINDER,
    suffix: suffixes.tomorrow,
    button: "course_link",
    content: (language) => getCourseDueDateReminderEmailTranslations(language, course, "", 1),
  },
  {
    key: KEYS.DEADLINE_UPCOMING,
    event: EVENTS.COURSE_DUE_DATE_REMINDER,
    suffix: suffixes.upcoming,
    button: "course_link",
    content: (language) => {
      const content = getCourseDueDateReminderEmailTranslations(language, course, "", 99);
      return {
        ...content,
        paragraphs: content.paragraphs.map((text) =>
          text.replace("99", "{{ days_before_due_date }}"),
        ),
      };
    },
  },
];

export function getEmailTemplateVariantPublication(
  key: BuiltInEmailTemplateKey,
): PublishedEmailTemplate | undefined {
  const variant = EMAIL_TEMPLATE_VARIANTS.find((variant) => variant.key === key);
  if (!variant) return undefined;
  const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT[variant.event];
  const publication: PublishedEmailTemplate = {
    name: {},
    subject: variant.subject
      ? buildNormalizedLocalizedSubjectTemplates(variant.subject)
      : definition.subjects,
    content: {},
    baseLanguage: definition.defaultLanguage,
    availableLocales: Object.values(SUPPORTED_LANGUAGES),
    placeholders: [],
  };
  const variables = new Map(definition.variables.map((variable) => [variable.key, variable]));
  for (const language of Object.values(SUPPORTED_LANGUAGES)) {
    publication.name[language] =
      `${definition.name[language] ?? definition.name.en} · ${variant.suffix[language]}`;
    publication.content[language] = createDocumentFromEmailContent(
      variant.content(language),
      `{{ ${variant.button} }}`,
    );
  }
  const keys = new Set(
    [
      ...JSON.stringify(publication.content).matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g),
      ...JSON.stringify(publication.subject).matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g),
    ].map((match) => match[1]!),
  );
  publication.placeholders = [...keys]
    .filter((key) => key !== "company_name")
    .map((name) => {
      const variable = variables.get(name);
      const type: AutomationPlaceholderType =
        variable?.type === "text" || variable?.type === "date"
          ? "string"
          : (variable?.type ?? "url");
      const sample = variable?.sampleValue;
      const sampleValue =
        typeof sample === "string" || typeof sample === "number" || typeof sample === "boolean"
          ? sample
          : "https://example.invalid/example";
      return { name, label: variable?.label ?? name, type, required: true, sampleValue };
    });
  return deriveEmailTemplatePublicationUsage(publication);
}
