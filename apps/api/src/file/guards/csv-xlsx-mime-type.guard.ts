import { BadRequestException } from "@nestjs/common";

const ALLOWED_CSV_XLSX_MIME_TYPES = [
  "text/csv",
  "application/csv", 
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/**
 * Guard specifically for CSV and XLSX file uploads
 * Used for user import functionality
 */
export class CsvXlsxMimeTypeGuard {
  static validateMimeType(mimetype: string | undefined): asserts mimetype is string {
    if (!mimetype || !this.isAllowedMimeType(mimetype)) {
      throw new BadRequestException(
        `File type ${
          mimetype || "unknown"
        } is not allowed. Only CSV and XLSX files are supported for user import.`,
      );
    }
  }

  private static isAllowedMimeType(mimetype: string): boolean {
    return ALLOWED_CSV_XLSX_MIME_TYPES.includes(
      mimetype as (typeof ALLOWED_CSV_XLSX_MIME_TYPES)[number]
    );
  }

  /**
   * Validates file extension as an additional check
   */
  static validateFileExtension(filename: string | undefined): void {
    if (!filename) {
      throw new BadRequestException("Filename is required");
    }

    const extension = filename.toLowerCase().split('.').pop();
    if (!extension || !['csv', 'xlsx'].includes(extension)) {
      throw new BadRequestException(
        "File extension must be .csv or .xlsx"
      );
    }
  }

  /**
   * Combined validation for both MIME type and file extension
   */
  static validateFile(file: Express.Multer.File): void {
    this.validateMimeType(file.mimetype);
    this.validateFileExtension(file.originalname);
  }
}