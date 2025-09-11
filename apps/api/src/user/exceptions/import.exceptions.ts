import { BadRequestException, ConflictException, InternalServerErrorException } from "@nestjs/common";

/**
 * Exception thrown when user import file validation fails
 */
export class ImportValidationException extends BadRequestException {
  constructor(message: string, validationErrors?: any[]) {
    super({
      message,
      validationErrors,
      error: "ImportValidationError",
    });
  }
}

/**
 * Exception thrown when user import file has unsupported format
 */
export class UnsupportedImportFileException extends BadRequestException {
  constructor(fileType?: string) {
    const message = fileType 
      ? `Unsupported file type: ${fileType}. Only CSV and XLSX files are supported.`
      : "Unsupported file format. Only CSV and XLSX files are supported.";
    
    super({
      message,
      error: "UnsupportedImportFileError",
    });
  }
}

/**
 * Exception thrown when duplicate users exist in import or database
 */
export class DuplicateUsersException extends ConflictException {
  constructor(duplicateEmails: string[]) {
    super({
      message: `Users with the following emails already exist: ${duplicateEmails.join(", ")}`,
      duplicateEmails,
      error: "DuplicateUsersError",
    });
  }
}

/**
 * Exception thrown when import file exceeds size limit
 */
export class ImportFileSizeException extends BadRequestException {
  constructor(actualSize: number, maxSize: number) {
    const actualSizeMB = Math.round(actualSize / 1024 / 1024);
    const maxSizeMB = Math.round(maxSize / 1024 / 1024);
    
    super({
      message: `File size (${actualSizeMB}MB) exceeds maximum limit of ${maxSizeMB}MB`,
      actualSize,
      maxSize,
      error: "ImportFileSizeError",
    });
  }
}

/**
 * Exception thrown when import file has missing required columns
 */
export class MissingColumnsException extends BadRequestException {
  constructor(missingColumns: string[], requiredColumns: string[]) {
    super({
      message: `Missing required columns: ${missingColumns.join(", ")}. Required columns are: ${requiredColumns.join(", ")}`,
      missingColumns,
      requiredColumns,
      error: "MissingColumnsError",
    });
  }
}

/**
 * Exception thrown when user import transaction fails
 */
export class ImportTransactionException extends InternalServerErrorException {
  constructor(message: string, originalError?: Error) {
    super({
      message: `Import transaction failed: ${message}`,
      originalError: originalError?.message,
      error: "ImportTransactionError",
    });
  }
}

/**
 * Exception thrown when email sending fails during import
 */
export class ImportEmailException extends InternalServerErrorException {
  constructor(failedEmails: string[], originalError?: Error) {
    super({
      message: `Failed to send emails to: ${failedEmails.join(", ")}`,
      failedEmails,
      originalError: originalError?.message,
      error: "ImportEmailError",
    });
  }
}