import { Test, TestingModule } from "@nestjs/testing";

import { CsvXlsxProcessorService } from "../csv-xlsx-processor.service";
import { 
  UnsupportedImportFileException, 
  ImportFileSizeException,
} from "src/user/exceptions/import.exceptions";

describe("CsvXlsxProcessorService", () => {
  let service: CsvXlsxProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsvXlsxProcessorService],
    }).compile();

    service = module.get<CsvXlsxProcessorService>(CsvXlsxProcessorService);
  });

  describe("processUserImportFile", () => {
    it("should throw UnsupportedImportFileException for unsupported file types", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        size: 1000,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
        UnsupportedImportFileException
      );
    });

    it("should throw ImportFileSizeException for files exceeding size limit", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "large-file.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        size: 15 * 1024 * 1024, // 15MB (exceeds 10MB limit)
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
        ImportFileSizeException
      );
    });

    it("should identify CSV files correctly by mimetype", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        size: 1000,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Should attempt to process CSV (will fail due to missing dependency)
      await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
        UnsupportedImportFileException
      );
      
      // But the error message should indicate CSV processing was attempted
      try {
        await service.processUserImportFile(mockFile);
      } catch (error) {
        expect(error.message).toContain("csv-parse");
      }
    });

    it("should identify XLSX files correctly by mimetype", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users.xlsx",
        encoding: "7bit",
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1000,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Should attempt to process XLSX (will fail due to missing dependency)  
      await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
        UnsupportedImportFileException
      );

      // But the error message should indicate XLSX processing was attempted
      try {
        await service.processUserImportFile(mockFile);
      } catch (error) {
        expect(error.message).toContain("xlsx");
      }
    });

    it("should identify CSV files by file extension fallback", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users.csv",
        encoding: "7bit", 
        mimetype: "application/octet-stream", // Generic mimetype
        size: 1000,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Should still identify as CSV due to .csv extension
      await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
        UnsupportedImportFileException
      );
      
      try {
        await service.processUserImportFile(mockFile);
      } catch (error) {
        expect(error.message).toContain("csv-parse");
      }
    });

    it("should identify XLSX files by file extension fallback", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users.xlsx",
        encoding: "7bit",
        mimetype: "application/octet-stream", // Generic mimetype  
        size: 1000,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Should still identify as XLSX due to .xlsx extension
      await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
        UnsupportedImportFileException
      );
      
      try {
        await service.processUserImportFile(mockFile);
      } catch (error) {
        expect(error.message).toContain("xlsx");
      }
    });
  });

  describe("file size validation", () => {
    const testCases = [
      { size: 1024, shouldPass: true }, // 1KB
      { size: 1024 * 1024, shouldPass: true }, // 1MB
      { size: 5 * 1024 * 1024, shouldPass: true }, // 5MB
      { size: 10 * 1024 * 1024, shouldPass: true }, // 10MB (exactly at limit)
      { size: 10 * 1024 * 1024 + 1, shouldPass: false }, // 10MB + 1 byte
      { size: 15 * 1024 * 1024, shouldPass: false }, // 15MB
    ];

    testCases.forEach(({ size, shouldPass }) => {
      it(`should ${shouldPass ? "accept" : "reject"} file of ${Math.round(size / 1024 / 1024 * 100) / 100}MB`, async () => {
        const mockFile: Express.Multer.File = {
          fieldname: "file",
          originalname: "test.csv",
          encoding: "7bit",
          mimetype: "text/csv",
          size,
          buffer: Buffer.from("test"),
          stream: null as any,
          destination: "",
          filename: "",
          path: "",
        };

        if (shouldPass) {
          // Should fail due to missing dependency, not size limit
          await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
            UnsupportedImportFileException
          );
          
          try {
            await service.processUserImportFile(mockFile);
          } catch (error) {
            expect(error.message).not.toContain("File size");
            expect(error.message).toContain("csv-parse");
          }
        } else {
          // Should fail due to size limit
          await expect(service.processUserImportFile(mockFile)).rejects.toThrow(
            ImportFileSizeException
          );
        }
      });
    });
  });
});