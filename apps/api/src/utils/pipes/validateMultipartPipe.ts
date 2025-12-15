import { BadRequestException, Injectable } from "@nestjs/common";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import type { PipeTransform } from "@nestjs/common";
import type { TObject, Static } from "@sinclair/typebox";

type MultipartValue = string | Buffer | File | undefined;
type ParsedValue = string | number | boolean | object | null;
type MultipartData = Record<string, MultipartValue | MultipartValue[]>;

@Injectable()
export class ValidateMultipartPipe<T extends TObject> implements PipeTransform {
  private readonly validator: ReturnType<typeof TypeCompiler.Compile<T>>;

  constructor(private readonly schema: T) {
    this.validator = TypeCompiler.Compile(schema);
  }

  transform(value: MultipartData): Static<T> {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("Invalid multipart form data");
    }

    const parsedData = this.parseMultipartToJSON(value);

    if (this.validator.Check(parsedData)) {
      return { ...parsedData } as Static<T>;
    } else {
      const errors = [...this.validator.Errors(parsedData)];
      const errorMessages = errors.map((error) => `${error.path}: ${error.message}`);

      throw new BadRequestException({
        message: "Validation failed",
        errors: errorMessages,
        statusCode: 400,
      });
    }
  }

  private parseMultipartToJSON(data: MultipartData): Record<string, ParsedValue> {
    const result: Record<string, ParsedValue> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        continue;
      }

      if (typeof value === "string" && value.trim() === "") {
        continue;
      }

      if (Array.isArray(value)) {
        const parsedArray = value
          .map((item) => this.parseValue(item))
          .filter((item) => !(typeof item === "string" && item.trim() === ""));

        if (!parsedArray.length) continue;
        result[key] = parsedArray;
        continue;
      }

      result[key] = this.parseValue(value);
    }

    return result;
  }

  private parseValue(value: MultipartValue): ParsedValue {
    if (typeof value !== "string") {
      return value as ParsedValue;
    }

    if (this.isJSONString(value)) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null) {
          return this.parseNestedObject(parsed);
        }
        return parsed;
      } catch {
        return value;
      }
    }

    if (this.isNumericString(value)) {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }

    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    return value;
  }

  private parseNestedObject(obj: unknown): ParsedValue {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.parseNestedValue(item));
    }

    if (obj && typeof obj === "object") {
      const result: Record<string, ParsedValue> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.parseNestedValue(value);
      }
      return result;
    }

    return obj as ParsedValue;
  }

  private parseNestedValue(value: unknown): ParsedValue {
    if (typeof value === "string") {
      return this.parseValue(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.parseNestedValue(item));
    }

    if (value && typeof value === "object") {
      const result: Record<string, ParsedValue> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.parseNestedValue(val);
      }
      return result;
    }

    return value as ParsedValue;
  }

  private isJSONString(value: string): boolean {
    const trimmed = value.trim();
    return (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
  }

  private isNumericString(value: string): boolean {
    return /^\d+(\.\d+)?$/.test(value.trim());
  }
}
