import { Injectable } from "@nestjs/common";

import { UnsupportedImportFileException, ImportFileSizeException, MissingColumnsException } from "src/user/exceptions/import.exceptions";

import type { ImportUserRow } from "src/user/schemas/userImport.schema";

/**
 * Service for processing CSV and XLSX files for user import
 * 
 * DEPENDENCIES REQUIRED:
 * - csv-parse: For CSV parsing
 * - xlsx: For XLSX parsing
 * 
 * Install with: npm install csv-parse xlsx @types/csv-parse
 */
@Injectable()
export class CsvXlsxProcessorService {
  private readonly REQUIRED_COLUMNS = ["name", "surname", "email", "role"];
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Processes uploaded CSV or XLSX file and returns user data
   * Validates file format and required columns
   */
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

  /**
   * Processes CSV file and returns parsed user data
   */
  private async processCsvFile(file: Express.Multer.File): Promise<ImportUserRow[]> {
    try {
      // TODO: Implement CSV parsing with csv-parse library
      // const parse = require('csv-parse/sync');
      // 
      // const records = parse.parse(file.buffer.toString(), {
      //   columns: true,
      //   skip_empty_lines: true,
      //   trim: true,
      // });
      
      // For now, throw an error indicating dependency is needed
      throw new UnsupportedImportFileException(
        "CSV processing requires 'csv-parse' library to be installed. " +
        "Run: npm install csv-parse @types/csv-parse"
      );

      // After installing dependencies, this would be the implementation:
      // return this.validateAndTransformRecords(records);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new UnsupportedImportFileException(`Error processing CSV file: ${error.message}`);
    }
  }

  /**
   * Processes XLSX file and returns parsed user data
   */
  private async processXlsxFile(file: Express.Multer.File): Promise<ImportUserRow[]> {
    try {
      // TODO: Implement XLSX parsing with xlsx library
      // const XLSX = require('xlsx');
      // 
      // const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      // const sheetName = workbook.SheetNames[0];
      // const worksheet = workbook.Sheets[sheetName];
      // const records = XLSX.utils.sheet_to_json(worksheet, { 
      //   header: 1,
      //   defval: '',
      // });
      
      // For now, throw an error indicating dependency is needed
      throw new UnsupportedImportFileException(
        "XLSX processing requires 'xlsx' library to be installed. " +
        "Run: npm install xlsx @types/node"
      );

      // After installing dependencies, this would be the implementation:
      // return this.validateAndTransformRecords(records);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new UnsupportedImportFileException(`Error processing XLSX file: ${error.message}`);
    }
  }

  /**
   * Validates and transforms raw records into ImportUserRow format
   */
  private validateAndTransformRecords(records: any[]): ImportUserRow[] {
    if (records.length === 0) {
      throw new UnsupportedImportFileException("File contains no data");
    }

    // Validate headers
    const headers = Object.keys(records[0]);
    this.validateRequiredColumns(headers);

    // Transform records to ImportUserRow format
    return records.map((record, index) => {
      try {
        return {
          name: this.sanitizeString(record.name),
          surname: this.sanitizeString(record.surname),
          email: this.sanitizeString(record.email),
          role: this.sanitizeString(record.role),
        };
      } catch (error) {
        throw new UnsupportedImportFileException(
          `Error processing row ${index + 1}: ${error.message}`
        );
      }
    });
  }

  /**
   * Validates that all required columns are present
   */
  private validateRequiredColumns(headers: string[]): void {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    const missingColumns = this.REQUIRED_COLUMNS.filter(
      col => !normalizedHeaders.includes(col.toLowerCase())
    );

    if (missingColumns.length > 0) {
      throw new MissingColumnsException(missingColumns, this.REQUIRED_COLUMNS);
    }
  }

  /**
   * Validates file size against the limit
   */
  private validateFileSize(file: Express.Multer.File): void {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new ImportFileSizeException(file.size, this.MAX_FILE_SIZE);
    }
  }

  /**
   * Checks if the file is a CSV file
   */
  private isCsvFile(file: Express.Multer.File): boolean {
    return (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/csv" ||
      file.originalname.toLowerCase().endsWith(".csv")
    );
  }

  /**
   * Checks if the file is an XLSX file
   */
  private isXlsxFile(file: Express.Multer.File): boolean {
    return (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx")
    );
  }

  /**
   * Sanitizes string input by trimming whitespace
   */
  private sanitizeString(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).trim();
  }
}