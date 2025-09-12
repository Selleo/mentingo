import { BadRequestException, Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { parse as CSVparse } from "csv-parse/sync";
import { read, utils as XLSXUtils } from "xlsx";

import {
  UnsupportedImportFileException,
  ImportFileSizeException,
  MissingColumnsException,
} from "src/user/exceptions/import.exceptions";
import { importUserRowSchema, type ImportUserRow } from "src/user/schemas/userImport.schema";

@Injectable()
export class CsvXlsxProcessorService {
  private readonly REQUIRED_COLUMNS = ["name", "surname", "email", "role"];
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  async processUserImportFile(file: Express.Multer.File): Promise<ImportUserRow[]> {
    this.validateFileSize(file);

    if (this.isCsvFile(file)) {
      return this.processCsvFile(file);
    } else if (this.isXlsxFile(file)) {
      return this.processXlsxFile(file);
    } else {
      throw new UnsupportedImportFileException(file.mimetype);
    }
  }

  private async processCsvFile(file: Express.Multer.File): Promise<ImportUserRow[]> {
    try {
      const records = CSVparse(file.buffer.toString(), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      return this.validateAndTransformRecords(records);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new UnsupportedImportFileException(`Error processing CSV file: ${error.message}`);
    }
  }

  private async processXlsxFile(file: Express.Multer.File): Promise<ImportUserRow[]> {
    try {
      const workbook = read(file.buffer, { type: "buffer" });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new UnsupportedImportFileException("XLSX file contains no sheets or is malformed.");
      }
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const records = XLSXUtils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      });

      return this.validateAndTransformRecords(records);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new UnsupportedImportFileException(`Error processing XLSX file: ${error.message}`);
    }
  }

  private validateAndTransformRecords(records: any[]): ImportUserRow[] {
    if (records.length === 0) {
      throw new UnsupportedImportFileException("File contains no data");
    }

    const headers = Object.keys(records[0]);
    this.validateRequiredColumns(headers);

    return records.map((record) => {
      const candidate = {
        name: this.sanitizeString(record.name),
        surname: this.sanitizeString(record.surname),
        email: this.sanitizeString(record.email),
        role: this.sanitizeString(record.role),
      };

      if (!Value.Check(importUserRowSchema, candidate)) {
        const errs = [...Value.Errors(importUserRowSchema, candidate)]
          .map((e) => `${e.path}: ${e.message}`)
          .join(", ");
        throw new BadRequestException(`Row validation failed: ${errs}`);
      }
      return candidate as ImportUserRow;
    });
  }

  private validateRequiredColumns(headers: string[]): void {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
    const missingColumns = this.REQUIRED_COLUMNS.filter(
      (col) => !normalizedHeaders.includes(col.toLowerCase()),
    );

    if (missingColumns.length > 0) {
      throw new MissingColumnsException(missingColumns, this.REQUIRED_COLUMNS);
    }
  }

  private validateFileSize(file: Express.Multer.File): void {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new ImportFileSizeException(file.size, this.MAX_FILE_SIZE);
    }
  }

  private isCsvFile(file: Express.Multer.File): boolean {
    return (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/csv" ||
      file.originalname.toLowerCase().endsWith(".csv")
    );
  }

  private isXlsxFile(file: Express.Multer.File): boolean {
    return (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx")
    );
  }

  private sanitizeString(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).trim();
  }
}
