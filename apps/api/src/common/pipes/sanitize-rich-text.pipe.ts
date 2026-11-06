import { Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import { sanitizeRichText } from "@repo/shared";
import { match, P } from "ts-pattern";

const ROOT_RICH_TEXT_FIELDS = new Set(["description", "content", "solutionExplanation"]);

const NESTED_RICH_TEXT_FIELDS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["questions", new Set(["title", "description", "solutionExplanation"])],
  ["translations", new Set(["content"])],
]);

const PLAIN_OBJECT_PROTOTYPES = new Set([Object.prototype, null]);

type BodyFields = Record<string, unknown>;

const isPlainObject = (value: unknown): value is BodyFields =>
  typeof value === "object" &&
  value !== null &&
  PLAIN_OBJECT_PROTOTYPES.has(Object.getPrototypeOf(value));

const sanitizeRichTextValue = (value: unknown): unknown =>
  match(value)
    .with(P.string, sanitizeRichText)
    .when(isPlainObject, (valuesByLanguage) =>
      Object.fromEntries(
        Object.entries(valuesByLanguage).map(([language, text]) => [
          language,
          typeof text === "string" ? sanitizeRichText(text) : text,
        ]),
      ),
    )
    .otherwise(() => value);

const sanitizeListedFields = (fields: BodyFields, richTextFields: ReadonlySet<string>) =>
  Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [
      field,
      richTextFields.has(field) ? sanitizeRichTextValue(value) : value,
    ]),
  );

const sanitizeNestedItems = (value: unknown, richTextFields: ReadonlySet<string>) =>
  match(value)
    .with(P.array(), (items) =>
      items.map((item) =>
        isPlainObject(item) ? sanitizeListedFields(item, richTextFields) : item,
      ),
    )
    .otherwise(() => value);

const sanitizeBodyFields = (body: BodyFields) =>
  Object.fromEntries(
    Object.entries(body).map(([field, value]) => {
      const nestedRichTextFields = NESTED_RICH_TEXT_FIELDS.get(field);

      if (ROOT_RICH_TEXT_FIELDS.has(field)) return [field, sanitizeRichTextValue(value)];
      if (nestedRichTextFields) return [field, sanitizeNestedItems(value, nestedRichTextFields)];

      return [field, value];
    }),
  );

/**
 * Sanitizes the known rich-text paths of a request body: root descriptions, contents and solution
 * explanations, quiz question titles, descriptions and explanations, and translation contents
 * (each as a string or per-language map). Other fields, such as AI configuration text, are kept.
 * Multipart bodies must also pass it after ValidateMultipartPipe, which decodes JSON fields.
 */
@Injectable()
export class SanitizeRichTextPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== "body") return value;

    if (metadata.data) {
      return ROOT_RICH_TEXT_FIELDS.has(metadata.data) ? sanitizeRichTextValue(value) : value;
    }

    return isPlainObject(value) ? sanitizeBodyFields(value) : value;
  }
}
