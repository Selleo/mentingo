import { EMAIL_TEMPLATE_VARIANTS, getEmailTemplateVariantPublication } from "./template-variants";
import {
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  type BuiltInEmailTemplateKey,
  type AutomationEventKind,
  type SupportedLanguages,
} from "@repo/shared";
import { SUPPORTED_LANGUAGES, type AutomationPlaceholderDefinition } from "@repo/shared";
import {
  EMAIL_TEMPLATE_SYSTEM_VARIABLES,
  EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT,
} from "./template-registry";
import { getOverdueCoursesEmailTranslations } from "./translations/overdueCourses";
import type { OverdueCoursesEmailCourse } from "./templates/OverdueCoursesEmail";
import { deriveEmailTemplatePublicationUsage } from "./template-usage";
import type { PublishedEmailTemplate } from "./publication.types";
import type {
  EmailTemplateEvent,
  EmailTemplateVariableDefinition,
} from "./template-registry.types";

export function toTemplatePlaceholder(
  variable: EmailTemplateVariableDefinition,
): AutomationPlaceholderDefinition {
  const type = variable.type === "text" || variable.type === "date" ? "string" : variable.type;
  return {
    name: variable.key,
    label: variable.label,
    type,
    required: Boolean(variable.required),
    sampleValue: variable.sampleValue as AutomationPlaceholderDefinition["sampleValue"],
  };
}

/** Email content is fixed; automation conditions choose the appropriate variant. */
export function getBuiltInTemplatePublication(
  key: BuiltInEmailTemplateKey,
): PublishedEmailTemplate {
  const variant = getEmailTemplateVariantPublication(key);
  if (variant) return variant;
  const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT[key as EmailTemplateEvent];
  if (!definition) throw new Error("Unknown built-in template");
  const samples = Object.fromEntries(
    [...EMAIL_TEMPLATE_SYSTEM_VARIABLES, ...definition.variables].map((variable) => [
      variable.key,
      variable.sampleValue,
    ]),
  );
  const placeholders = definition.variables.map(toTemplatePlaceholder);
  const publication = {
    name: definition.name,
    subject: definition.subjects,
    content: definition.defaultDocuments,
    baseLanguage: definition.defaultLanguage,
    availableLocales: Object.values(SUPPORTED_LANGUAGES),
    placeholders,
  };
  if (key === "admin_overdue_courses") {
    publication.content = JSON.parse(
      JSON.stringify(publication.content).replace(
        /{{\s*courses\s*}}/g,
        "{{ overdue_courses_summary }}",
      ),
    );
    publication.placeholders = placeholders.map((placeholder) =>
      placeholder.name === "courses"
        ? {
            ...placeholder,
            name: "overdue_courses_summary",
            type: "localized_string" as const,
            sampleValue: getOverdueCoursesEmailTranslations(
              SUPPORTED_LANGUAGES.EN,
              samples.courses as OverdueCoursesEmailCourse[],
            ).paragraphs.join("\n"),
          }
        : placeholder,
    );
  }
  return deriveEmailTemplatePublicationUsage(publication);
}

/** Each locale receives its producer-resolved collection and language-specific labels. */
export function buildOverdueCoursesEventFields(
  courses: Partial<Record<SupportedLanguages, OverdueCoursesEmailCourse[]>>,
) {
  return {
    overdue_courses_summary: Object.fromEntries(
      Object.values(SUPPORTED_LANGUAGES).map((language) => [
        language,
        getOverdueCoursesEmailTranslations(
          language,
          courses[language] ?? courses.en ?? [],
        ).paragraphs.join("\n"),
      ]),
    ),
  };
}

export const VISIBLE_BUILT_IN_EMAIL_TEMPLATE_KEYS = Object.values(BUILT_IN_EMAIL_TEMPLATE_KEYS);
export function getBuiltInTemplateEvent(key: BuiltInEmailTemplateKey): AutomationEventKind {
  return (
    EMAIL_TEMPLATE_VARIANTS.find((variant) => variant.key === key)?.event ??
    (key as AutomationEventKind)
  );
}
