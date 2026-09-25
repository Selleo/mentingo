import { fromJsonSchema } from "@modelcontextprotocol/server";

import type { Static, TSchema } from "@sinclair/typebox";

const parameterHelp: Record<string, string> = {
  aiJudgeConfiguration: "AI Judge configuration for evaluating this lesson.",
  aiMentorConfiguration: "AI Mentor configuration for this lesson.",
  allowFullscreen: "Whether the embedded resource may enter fullscreen mode.",
  id: "ID of the item to read or edit, returned by its list or create tool.",
  language: "Language code for the content to read or edit. Use a supported Mentingo language.",
  courseId: "ID of the course, returned by list_courses or create_course.",
  chapterId: "ID of the chapter, returned by list_chapters or create_chapter.",
  lessonId: "ID of the lesson, returned by list_lessons or a create lesson tool.",
  qaId: "ID of the Q&A entry, returned by list_qa_entries.",
  pathId: "ID of the development path, returned by list_development_paths.",
  sectionId: "ID of the article section, returned by list_article_sections.",
  categoryId: "ID of a course category, returned by list_categories or list_course_categories.",
  baseLanguage:
    "Supported language to use as the category's primary language. It must already have a title.",
  targetId: "ID of the content receiving the uploaded file.",
  resourceId:
    "Resource ID from the upload response's data.resourceId, or an existing lesson attachment. A fresh upload is attached when inserted into content.",
  groupId:
    "ID of a group already assigned to the course; find it with list_course_group_deadlines.",
  dueDate: "ISO 8601 date and time with timezone, or null to clear the group's course deadline.",
  uploadId: "ID returned when the video upload was initialized.",
  expectedRevision:
    "Current revision returned by the matching get tool; the edit fails if the content has changed.",
  idempotencyKey:
    "Stable, caller-generated key for this creation attempt. Reuse it only when retrying the same request.",
  page: "One-based page number. Defaults to 1 when omitted.",
  pageSize: "Number of results per page. Defaults to 20 when omitted.",
  sort: "Sort by title or creation date. Prefix with '-' for descending order; defaults to title.",
  query: "Optional text to filter matching titles or names.",
  status: "Publication status. Use one of the values accepted by this tool.",
  title: "Content title in the selected language.",
  description: "Content body or description in the selected language.",
  summary: "Short summary in the selected language.",
  content: "Article or news body in the selected language.",
  confirmTitle: "Exact current title of the item, required to confirm deletion.",
  confirmLanguage: "Exact language code of the translation to remove.",
  confirmCourseId: "Repeat the exact courseId to confirm removal from the path.",
  confirmResourceId: "Repeat the exact resourceId to confirm detachment.",
  confirmLessonIds: "IDs of all lessons in the chapter, confirming they will be deleted with it.",
  confirmType: "Current lesson type, required to confirm deletion.",
  confirmPublish: "Set to true to confirm publishing or making content visible.",
  displayOrder: "New one-based position within the parent chapter or course.",
  thumbnailPositionY: "Vertical focal position of the existing thumbnail, as a percentage.",
  thumbnail: "Optional image to upload with the new SCORM course.",
  priceInCents: "Course price in the smallest currency unit (for example, cents).",
  currency: "Three-letter currency code.",
  filename: "Name of the local file, including its extension.",
  mimeType: "MIME type of the file bytes to upload.",
  size: "Exact file size in bytes; the uploaded bytes must match.",
  transport: "Upload transport: multipart or resumable TUS. Omit to use the tool default.",
  kind: "Which image or signature is being uploaded.",
  targetType: "Type of content receiving the upload.",
  enabled: "Whether to enable this course setting.",
  sequenceEnabled: "Whether learners must follow the specified course order.",
  includesCertificate: "Whether the development path awards a certificate.",
  lessonSequenceEnabled: "Whether learners must follow lesson order.",
  quizFeedbackEnabled: "Whether to show learners quiz feedback.",
  videoCompletionTrackingEnabled: "Whether video progress is required for completion.",
  certificateFontColor: "Color used for certificate text.",
  certificateValidity: "Certificate validity settings; null removes the validity period.",
  applyValidityToExistingCertificates:
    "Apply the new validity settings to already issued certificates.",
  removeCertificateSignature: "Remove the current certificate signature.",
  resource: "Content area for the generic file upload.",
  thresholdScore: "Minimum passing score as a percentage.",
  attemptsLimit: "Maximum quiz attempts: a positive integer, or null for no limit.",
  quizCooldownInHours:
    "Hours between quiz attempts: a nonnegative integer, or null to disable the cooldown.",
  questions: "Complete set of quiz questions and answer options.",
  resources: "Embed resources; each fileUrl must use HTTPS.",
  displayMode:
    "How the file appears in lesson content: preview or download. Available modes depend on its file type.",
  fileUrl: "HTTPS URL of the embedded resource.",
  courseIds: "Unique course IDs in the requested order.",
  translations: "Localized content sent with the native editorial cover upload.",
  name: "Display name in the selected language.",
  voiceMode: "AI Mentor voice mode.",
  ttsPreset: "AI Mentor text-to-speech preset.",
  customTtsReference: "Reference for a custom text-to-speech voice, or null to clear it.",
};

type JsonSchemaObject = Record<string, unknown>;

function describeSchema(value: unknown, field?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => describeSchema(item));
  if (!value || typeof value !== "object") return value;

  const source = value as JsonSchemaObject;
  const schema: JsonSchemaObject = { ...source };
  if (source.properties && typeof source.properties === "object") {
    schema.properties = Object.fromEntries(
      Object.entries(source.properties).map(([name, property]) => [
        name,
        describeSchema(property, name),
      ]),
    );
  }
  for (const key of ["items", "anyOf", "oneOf", "allOf"] as const) {
    if (source[key] !== undefined) schema[key] = describeSchema(source[key]);
  }

  if (field) {
    const details: string[] = [];
    for (const [key, label] of [
      ["minimum", "Minimum"],
      ["maximum", "Maximum"],
      ["minLength", "Minimum length"],
      ["maxLength", "Maximum length"],
      ["minItems", "Minimum items"],
      ["maxItems", "Maximum items"],
    ] as const) {
      if (typeof source[key] === "number") details.push(`${label}: ${source[key]}.`);
    }
    if (source.uniqueItems === true) details.push("Items must be unique.");
    if (source.format === "uuid") details.push("Must be a UUID.");
    const variants = Array.isArray(source.anyOf) ? source.anyOf : undefined;
    const literalChoices = variants?.map((variant) => (variant as JsonSchemaObject).const);
    let choices = Array.isArray(source.enum) ? source.enum : undefined;
    if (!choices && literalChoices?.every((choice) => choice !== undefined))
      choices = literalChoices;
    if (choices?.length) details.push(`Allowed values: ${choices.map(String).join(", ")}.`);
    const help = parameterHelp[field];
    const existing = typeof source.description === "string" ? source.description : help;
    if (existing || details.length)
      schema.description = [existing, ...details].filter(Boolean).join(" ");
  }
  return schema;
}

/** Keep MCP's runtime validator and handler input type tied to the same TypeBox schema. */
export function asMcpInputSchema<T extends TSchema>(schema: T) {
  return fromJsonSchema<Static<T>>(describeSchema(schema) as T);
}
