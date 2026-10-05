import { Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import { sanitizeRichText } from "@repo/shared";

const RICH_TEXT_FIELDS = new Set(["description", "content", "solutionExplanation"]);

function sanitizeBody(value: unknown, key?: string, inQuestions = false): unknown {
  if (typeof value === "string") {
    return key && (RICH_TEXT_FIELDS.has(key) || (key === "title" && inQuestions))
      ? sanitizeRichText(value)
      : value;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeBody(item, key, inQuestions));
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value).map(([field, child]) => [
      field,
      sanitizeBody(
        child,
        RICH_TEXT_FIELDS.has(key ?? "") ? key : field,
        inQuestions || field === "questions",
      ),
    ]),
  );
}

@Injectable()
export class SanitizeRichTextPipe implements PipeTransform {
  transform<T>(value: T, metadata: ArgumentMetadata): T {
    return metadata.type === "body" ? (sanitizeBody(value, metadata.data) as T) : value;
  }
}
