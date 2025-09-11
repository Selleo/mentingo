import { Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { BulkUserService } from "./bulk-user.service";
import { importUserRowSchema } from "./schemas/userImport.schema";

import type { ImportUserRow, ValidationError } from "./schemas/userImport.schema";

export interface ImportValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  totalRows: number;
}

@Injectable()
export class ImportValidationService {
  constructor(private readonly bulkUserService: BulkUserService) {}

  /**
   * Validates all user import data with comprehensive checks
   * Implements all-or-nothing validation logic
   */
  public async validateImport(userRows: ImportUserRow[]): Promise<ImportValidationResult> {
    const errors: ValidationError[] = [];

    if (userRows.length === 0) {
      errors.push({
        row: 0,
        field: "file",
        value: null,
        message: "File contains no user data",
      });

      return {
        isValid: false,
        errors,
        totalRows: 0,
      };
    }

    // Validate each row individually
    userRows.forEach((userRow, index) => {
      const rowNumber = index + 1;
      const rowErrors = this.validateUserRow(userRow, rowNumber);
      errors.push(...rowErrors);
    });

    // Validate uniqueness within the import and against existing users
    const uniquenessErrors = await this.bulkUserService.validateUserRows(userRows);
    errors.push(...uniquenessErrors);

    return {
      isValid: errors.length === 0,
      errors,
      totalRows: userRows.length,
    };
  }

  /**
   * Validates a single user row for required fields and format
   */
  private validateUserRow(userRow: ImportUserRow, rowNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];

    const typeboxErrors = [...Value.Errors(importUserRowSchema, userRow)];

    if (typeboxErrors.length > 0) {
      for (const error of typeboxErrors) {
        const field = error.path.replace("/", ""); // Remove leading slash
        errors.push({
          row: rowNumber,
          field: field as keyof ImportUserRow,
          value: userRow[field as keyof ImportUserRow] || null,
          message: error.message,
        });
      }
    }

    return errors;
  }
}
