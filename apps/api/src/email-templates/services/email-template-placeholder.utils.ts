import { Faker, en, pl, de, fr, es, cs_CZ, base } from "@faker-js/faker";
import {
  SUPPORTED_LANGUAGES,
  AUTOMATION_PLACEHOLDER_TYPES,
  type SupportedLanguages,
  type AutomationPlaceholderDefinition,
  type AutomationPlaceholderValue,
  type AutomationPlaceholderType,
} from "@repo/shared";

import { AUTOMATION_EVENT_CATALOG } from "src/automations/catalog/automation-event-catalog";

const PREVIEW_LOCALES: Record<SupportedLanguages, typeof en> = {
  en,
  pl,
  de,
  fr,
  es,
  cs: cs_CZ,
  lt: en,
};

const PREVIEW_TEXT: Record<SupportedLanguages, { course: string; example: string }> = {
  en: { course: "Leadership essentials", example: "Example" },
  pl: { course: "Podstawy przywództwa", example: "Przykład" },
  de: { course: "Grundlagen der Führung", example: "Beispiel" },
  fr: { course: "Les bases du leadership", example: "Exemple" },
  es: { course: "Fundamentos del liderazgo", example: "Ejemplo" },
  cs: { course: "Základy vedení", example: "Příklad" },
  lt: { course: "Lyderystės pagrindai", example: "Pavyzdys" },
};

export function generateEmailPreviewRecipient(
  language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
) {
  const { name, email } = generateEmailPreviewIdentity(language);

  return { name, email };
}

/** Preview fixtures never contain tenant records or author-provided example values. */
export function generateEmailPreviewTagValue(
  name: string,
  type: AutomationPlaceholderType,
  language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
): AutomationPlaceholderValue {
  if (type === AUTOMATION_PLACEHOLDER_TYPES.URL) {
    return `https://example.invalid/email-preview/${name}`;
  }

  if (type === AUTOMATION_PLACEHOLDER_TYPES.NUMBER) {
    return createEmailPreviewFaker(language).number.int({ min: 2, max: 14 });
  }

  if (
    type === AUTOMATION_PLACEHOLDER_TYPES.STRING ||
    type === AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING
  ) {
    const text = generateRecognizedTextTagValue(name, language);

    if (text !== undefined) {
      return text;
    }
  }

  const catalogValue = findCatalogTagSample(name, type, language);

  if (catalogValue !== undefined) {
    return catalogValue;
  }

  return getDefaultTagSample(type, language);
}

export function addEmailTagLabelsAndSampleValues(
  placeholders: AutomationPlaceholderDefinition[],
): AutomationPlaceholderDefinition[] {
  return placeholders.map((placeholder) => ({
    ...placeholder,
    label: formatEmailTagLabel(placeholder.name),
    sampleValue: generateEmailPreviewTagValue(placeholder.name, placeholder.type),
  }));
}

/** Each caller gets independent, reproducible Faker state. */
function createEmailPreviewFaker(language: SupportedLanguages): Faker {
  const faker = new Faker({ locale: [PREVIEW_LOCALES[language], en, base] });

  faker.seed(20261007);

  return faker;
}

function generateEmailPreviewIdentity(language: SupportedLanguages) {
  const faker = createEmailPreviewFaker(language);
  const sex = faker.person.sexType();

  const firstName =
    language === SUPPORTED_LANGUAGES.LT
      ? faker.helpers.arrayElement(["Jonas", "Mantas", "Tomas"])
      : faker.person.firstName(sex);

  const lastName =
    language === SUPPORTED_LANGUAGES.LT
      ? faker.helpers.arrayElement(["Kazlauskas", "Jankauskas", "Petrauskas"])
      : faker.person.lastName(sex);

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName, provider: "example.invalid" }),
  };
}

function generateRecognizedTextTagValue(
  name: string,
  language: SupportedLanguages,
): string | undefined {
  const key = name.replace(/_/g, "").toLowerCase();
  const recipient = generateEmailPreviewIdentity(language);

  if (key.includes("email")) {
    return recipient.email;
  }

  if (key.includes("firstname")) {
    return recipient.firstName;
  }

  if (key.includes("lastname")) {
    return recipient.lastName;
  }

  if (/^(name|username|fullname|invitedbyusername)$/.test(key)) {
    return recipient.name;
  }

  if (key.includes("coursename")) {
    return PREVIEW_TEXT[language].course;
  }

  if (/date|deadline/.test(key) && !/message/.test(key)) {
    return generateEmailPreviewDate(language);
  }

  return undefined;
}

function generateEmailPreviewDate(language: SupportedLanguages): string {
  const date = createEmailPreviewFaker(language).date.between({
    from: "2026-10-01T12:00:00Z",
    to: "2026-12-01T12:00:00Z",
  });

  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function findCatalogTagSample(
  name: string,
  type: AutomationPlaceholderType,
  language: SupportedLanguages,
): AutomationPlaceholderValue | undefined {
  const field = AUTOMATION_EVENT_CATALOG.flatMap((event) => event.fields).find(
    (candidate) => candidate.key === name && candidate.type === type,
  );

  if (!field) {
    return undefined;
  }

  const value = field.sampleValue;

  if (
    type === AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value[language] ?? value[SUPPORTED_LANGUAGES.EN] ?? PREVIEW_TEXT[language].example;
  }

  return value;
}

function getDefaultTagSample(
  type: AutomationPlaceholderType,
  language: SupportedLanguages,
): AutomationPlaceholderValue {
  switch (type) {
    case AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN:
      return true;
    case AUTOMATION_PLACEHOLDER_TYPES.COLLECTION:
      return [];
    default:
      return PREVIEW_TEXT[language].example;
  }
}

function formatEmailTagLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}
