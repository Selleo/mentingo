import { BadRequestException, Injectable } from "@nestjs/common";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import type { PipeTransform } from "@nestjs/common";
import type { TObject, Static } from "@sinclair/typebox";

@Injectable()
export class ValidateMultipartPipe<T extends TObject> implements PipeTransform {
  private readonly validator: ReturnType<typeof TypeCompiler.Compile<T>>;

  constructor(private readonly schema: T) {
    this.validator = TypeCompiler.Compile(schema);
  }

  transform(value: any): Static<T> {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("Invalid multipart form data");
    }

    const parsedData = this.parseMultipartToJSON(value);

    if (this.validator.Check(parsedData)) {
      return parsedData as Static<T>;
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

  private parseMultipartToJSON(data: any): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        result[key] = value.map((item) => this.parseValue(item));
        continue;
      }

      result[key] = this.parseValue(value);
    }

    return result;
  }

  private parseValue(value: any): any {
    if (typeof value !== "string") {
      return value;
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

  private parseNestedObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.parseValue(item));
    }

    if (obj && typeof obj === "object") {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.parseValue(value);
      }
      return result;
    }

    return obj;
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
