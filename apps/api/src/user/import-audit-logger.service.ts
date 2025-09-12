import { Injectable, Logger } from "@nestjs/common";

interface ImportAuditContext {
  requestId?: string;
  userId?: string;
  userRole?: string;
  fileName?: string;
  fileSize?: number;
  timestamp: string;
}

interface ImportAttemptLog extends ImportAuditContext {
  totalRows: number;
  validationStatus: "pending" | "passed" | "failed";
}

interface ImportResultLog extends ImportAuditContext {
  totalRows: number;
  successCount: number;
  failureCount: number;
  validationErrors?: any[];
  processingTimeMs: number;
  status: "success" | "partial_failure" | "total_failure";
}

interface ImportErrorLog extends ImportAuditContext {
  error: string;
  errorType: string;
  stack?: string;
}

/**
 * Structured logging service for user import audit trail
 * Provides consistent logging format for compliance and debugging
 */
@Injectable()
export class ImportAuditLoggerService {
  private readonly logger = new Logger(ImportAuditLoggerService.name);

  /**
   * Logs the start of an import attempt
   */
  logImportAttempt(data: Omit<ImportAttemptLog, "timestamp">): void {
    const logData: ImportAttemptLog = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`Import attempt started`, {
      event: "IMPORT_ATTEMPT_STARTED",
      ...logData,
    });
  }

  /**
   * Logs successful import completion with detailed results
   */
  logImportSuccess(data: Omit<ImportResultLog, "timestamp" | "status">): void {
    const logData: ImportResultLog = {
      ...data,
      status: data.failureCount > 0 ? "partial_failure" : "success",
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`Import completed successfully`, {
      event: "IMPORT_COMPLETED",
      ...logData,
    });
  }

  /**
   * Logs import validation failures
   */
  logValidationFailure(
    data: Omit<ImportResultLog, "timestamp" | "status" | "successCount">
  ): void {
    const logData = {
      ...data,
      successCount: 0,
      status: "total_failure" as const,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Import validation failed`, {
      event: "IMPORT_VALIDATION_FAILED",
      ...logData,
    });
  }

  /**
   * Logs critical import errors (system failures, transaction rollbacks)
   */
  logImportError(data: Omit<ImportErrorLog, "timestamp">): void {
    const logData: ImportErrorLog = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(`Import error occurred`, {
      event: "IMPORT_ERROR",
      ...logData,
    });
  }

  /**
   * Logs security-related events (unauthorized access attempts)
   */
  logSecurityEvent(
    event: string,
    data: Partial<ImportAuditContext> & { securityReason: string }
  ): void {
    const logData = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Security event: ${event}`, {
      event: "SECURITY_EVENT",
      securityEvent: event,
      ...logData,
    });
  }

  /**
   * Logs file processing events for debugging
   */
  logFileProcessing(
    event: "file_uploaded" | "file_validated" | "file_processed" | "file_cleanup",
    data: Partial<ImportAuditContext> & { details?: any }
  ): void {
    const logData = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(`File processing: ${event}`, {
      event: "FILE_PROCESSING",
      processingEvent: event,
      ...logData,
    });
  }

  /**
   * Logs user creation events for each successfully created user
   */
  logUserCreation(
    userEmail: string,
    userId: string,
    context: Partial<ImportAuditContext>
  ): void {
    const logData = {
      ...context,
      userEmail,
      createdUserId: userId,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`User created via import`, {
      event: "USER_CREATED_VIA_IMPORT",
      ...logData,
    });
  }

  /**
   * Logs email sending attempts and results
   */
  logEmailEvent(
    event: "email_sent" | "email_failed",
    recipientEmail: string,
    context: Partial<ImportAuditContext> & { error?: string }
  ): void {
    const logData = {
      ...context,
      recipientEmail,
      timestamp: new Date().toISOString(),
    };

    if (event === "email_failed") {
      this.logger.warn(`Welcome email failed`, {
        event: "IMPORT_EMAIL_FAILED",
        ...logData,
      });
    } else {
      this.logger.log(`Welcome email sent`, {
        event: "IMPORT_EMAIL_SENT",
        ...logData,
      });
    }
  }

  /**
   * Creates a standardized context object for consistent logging
   */
  createContext(
    userId?: string,
    userRole?: string,
    fileName?: string,
    fileSize?: number,
    requestId?: string
  ): ImportAuditContext {
    return {
      userId,
      userRole,
      fileName,
      fileSize,
      requestId: requestId || this.generateRequestId(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generates a unique request ID for tracking related log entries
   */
  private generateRequestId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}