import { BadRequestException, Injectable } from "@nestjs/common";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import type { PipeTransform } from "@nestjs/common";
import type { TObject, Static, TSchema } from "@sinclair/typebox";

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

      const fieldSchema = this.getObjectPropertySchema(this.schema, key);

      if (Array.isArray(value)) {
        const itemSchema = this.getArrayItemSchema(fieldSchema);
        const parsedArray = value.map((item) => this.parseValue(item, itemSchema));

        if (!parsedArray.length) continue;
        result[key] = parsedArray;
        continue;
      }

      result[key] = this.parseValue(value, fieldSchema);
    }

    return result;
  }

  private parseValue(value: MultipartValue, schema?: TSchema): ParsedValue {
    if (typeof value !== "string") {
      return value as ParsedValue;
    }

    if (this.isStringSchema(schema)) return value;

    if (this.isJSONString(value)) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null) {
          return this.parseNestedObject(parsed, schema);
        }
        return parsed;
      } catch {
        return value;
      }
    }

    if (this.shouldParseNumber(schema, value)) {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }

    if (this.shouldParseBoolean(schema, value)) {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }

    return value;
  }

  private parseNestedObject(obj: unknown, schema?: TSchema): ParsedValue {
    if (Array.isArray(obj)) {
      const itemSchema = this.getArrayItemSchema(schema);
      return obj.map((item) => this.parseNestedValue(item, itemSchema));
    }

    if (obj && typeof obj === "object") {
      const result: Record<string, ParsedValue> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.parseNestedValue(value, this.getObjectPropertySchema(schema, key));
      }
      return result;
    }

    return obj as ParsedValue;
  }

  private parseNestedValue(value: unknown, schema?: TSchema): ParsedValue {
    if (typeof value === "string") {
      return this.parseValue(value, schema);
    }

    if (Array.isArray(value)) {
      const itemSchema = this.getArrayItemSchema(schema);
      return value.map((item) => this.parseNestedValue(item, itemSchema));
    }

    if (value && typeof value === "object") {
      const result: Record<string, ParsedValue> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.parseNestedValue(val, this.getObjectPropertySchema(schema, key));
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

  private getObjectPropertySchema(schema: TSchema | undefined, key: string): TSchema | undefined {
    const objectSchema = schema as (TSchema & { properties?: Record<string, TSchema> }) | undefined;

    return objectSchema?.properties?.[key];
  }

  private getArrayItemSchema(schema: TSchema | undefined): TSchema | undefined {
    const arraySchema = schema as (TSchema & { items?: TSchema }) | undefined;

    return arraySchema?.items;
  }

  private isStringSchema(schema: TSchema | undefined) {
    return (schema as { type?: string } | undefined)?.type === "string";
  }

  private shouldParseNumber(schema: TSchema | undefined, value: string) {
    const schemaType = (schema as { type?: string } | undefined)?.type;

    return (schemaType === "number" || schemaType === undefined) && this.isNumericString(value);
  }

  private shouldParseBoolean(schema: TSchema | undefined, value: string) {
    const schemaType = (schema as { type?: string } | undefined)?.type;
    const isBooleanString = value.toLowerCase() === "true" || value.toLowerCase() === "false";

    return (schemaType === "boolean" || schemaType === undefined) && isBooleanString;
  }
}
