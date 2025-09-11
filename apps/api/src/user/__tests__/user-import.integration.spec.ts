import * as fs from "fs";
import * as path from "path";

import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { EmailService } from "src/common/emails/emails.service";
import { CsvXlsxProcessorService } from "src/file/csv-xlsx-processor.service";
import { users, createTokens, userDetails } from "src/storage/schema";

import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { setupTestDatabase, closeTestDatabase } from "../../../test/test-database";
import { BulkUserService } from "../bulk-user.service";
import { ImportAuditLoggerService } from "../import-audit-logger.service";
import { ImportValidationService } from "../import-validation.service";
import { USER_ROLES } from "../schemas/userRoles";
import { UserImportController } from "../user-import.controller";

import type { TestingModule } from "@nestjs/testing";
import type { DatabasePg } from "src/common";

describe("UserImportController Integration Tests", () => {
  let controller: UserImportController;
  let module: TestingModule;
  let db: DatabasePg;
  let emailService: jest.Mocked<EmailService>;
  let userFactory: ReturnType<typeof createUserFactory>;

  const testFixturesPath = path.join(__dirname, "../../../test/fixtures");

  beforeAll(async () => {
    const { db: testDb } = await setupTestDatabase();
    db = testDb;
    userFactory = createUserFactory(db);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    module = await Test.createTestingModule({
      controllers: [UserImportController],
      providers: [
        BulkUserService,
        ImportValidationService,
        ImportAuditLoggerService,
        CsvXlsxProcessorService,
        {
          provide: "DB",
          useValue: db,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<UserImportController>(UserImportController);
    emailService = module.get<EmailService>(EmailService) as jest.Mocked<EmailService>;
  });

  afterEach(async () => {
    await truncateTables(db, ["users", "create_tokens", "user_details"]);
    jest.clearAllMocks();
    await module.close();
  });

  describe("CSV File Import Integration", () => {
    it("should successfully import valid CSV file with real database operations", async () => {
      // Read actual CSV test file
      const csvFilePath = path.join(testFixturesPath, "users-valid.csv");
      const csvBuffer = fs.readFileSync(csvFilePath);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users-valid.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
        destination: "",
        filename: "",
        path: "",
        stream: null as any,
      };

      // Mock the CSV processor to return parsed data (since dependencies might not be fully set up)
      const csvProcessorService = module.get<CsvXlsxProcessorService>(CsvXlsxProcessorService);
      const mockProcessedData = [
        { name: "John", surname: "Doe", email: "john.doe@example.com", role: USER_ROLES.STUDENT },
        {
          name: "Jane",
          surname: "Smith",
          email: "jane.smith@example.com",
          role: USER_ROLES.CONTENT_CREATOR,
        },
        {
          name: "Bob",
          surname: "Johnson",
          email: "bob.johnson@example.com",
          role: USER_ROLES.ADMIN,
        },
      ];

      jest.spyOn(csvProcessorService, "processUserImportFile").mockResolvedValue(mockProcessedData);

      // Execute import
      const result = await controller.importUsers({ data: { validateOnly: false } }, mockFile);

      // Verify response
      expect(result.data.successCount).toBe(3);
      expect(result.data.totalRows).toBe(3);
      expect(result.data.createdUsers).toHaveLength(3);
      expect(result.data.message).toContain("Successfully imported 3 users");

      // Verify database state - users created
      const createdUsers = await db.select().from(users);
      expect(createdUsers).toHaveLength(3);

      const userEmails = createdUsers.map((u) => u.email).sort();
      expect(userEmails).toEqual([
        "bob.johnson@example.com",
        "jane.smith@example.com",
        "john.doe@example.com",
      ]);

      // Verify database state - create tokens created
      const createdTokens = await db.select().from(createTokens);
      expect(createdTokens).toHaveLength(3);
      createdTokens.forEach((token) => {
        expect(token.createToken).toBeDefined();
        expect(token.expiryDate).toBeDefined();
        expect(token.reminderCount).toBe(0);
      });

      // Verify database state - user details created for CONTENT_CREATOR and ADMIN
      const userDetailsRecords = await db.select().from(userDetails);
      expect(userDetailsRecords).toHaveLength(2); // Only CONTENT_CREATOR and ADMIN

      // Verify email service called
      expect(emailService.sendEmail).toHaveBeenCalledTimes(3);
    });

    it("should handle validation failures with real database checks", async () => {
      // Create existing user in database first
      await userFactory.create({
        email: "john.doe@example.com",
        firstName: "Existing",
        lastName: "User",
        role: USER_ROLES.STUDENT,
      });

      const csvFilePath = path.join(testFixturesPath, "users-valid.csv");
      const csvBuffer = fs.readFileSync(csvFilePath);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users-valid.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
        destination: "",
        filename: "",
        path: "",
        stream: null as any,
      };

      // Mock the CSV processor to return data that conflicts with existing user
      const csvProcessorService = module.get<CsvXlsxProcessorService>(CsvXlsxProcessorService);
      const mockProcessedData = [
        { name: "John", surname: "Doe", email: "john.doe@example.com", role: USER_ROLES.STUDENT }, // Conflicts with existing
        {
          name: "Jane",
          surname: "Smith",
          email: "jane.smith@example.com",
          role: USER_ROLES.CONTENT_CREATOR,
        },
      ];

      jest.spyOn(csvProcessorService, "processUserImportFile").mockResolvedValue(mockProcessedData);

      // Execute import
      const result = await controller.importUsers({ data: { validateOnly: false } }, mockFile);

      // Verify error response
      expect(result.data.message).toBe("Import validation failed");
      expect(result.data.errors).toBeDefined();
      expect(result.data.errors.length).toBeGreaterThan(0);
      expect(result.data.errors[0].message).toContain("already exists");

      // Verify no new users created (all-or-nothing)
      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(1); // Only the original user

      // Verify no emails sent
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("should handle validation-only mode without creating users", async () => {
      const csvFilePath = path.join(testFixturesPath, "users-valid.csv");
      const csvBuffer = fs.readFileSync(csvFilePath);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users-valid.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
        destination: "",
        filename: "",
        path: "",
        stream: null as any,
      };

      const csvProcessorService = module.get<CsvXlsxProcessorService>(CsvXlsxProcessorService);
      const mockProcessedData = [
        { name: "John", surname: "Doe", email: "john.doe@example.com", role: USER_ROLES.STUDENT },
        {
          name: "Jane",
          surname: "Smith",
          email: "jane.smith@example.com",
          role: USER_ROLES.CONTENT_CREATOR,
        },
      ];

      jest.spyOn(csvProcessorService, "processUserImportFile").mockResolvedValue(mockProcessedData);

      // Execute validation-only import
      const result = await controller.importUsers({ data: { validateOnly: true } }, mockFile);

      // Verify validation-only response
      expect(result.data.message).toContain("validation mode");
      expect(result.data.successCount).toBe(0);
      expect(result.data.totalRows).toBe(2);
      expect(result.data.createdUsers).toHaveLength(0);

      // Verify no users created in database
      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(0);

      // Verify no emails sent
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("should handle duplicate emails within import file", async () => {
      const csvFilePath = path.join(testFixturesPath, "users-invalid.csv");
      const csvBuffer = fs.readFileSync(csvFilePath);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users-invalid.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
        destination: "",
        filename: "",
        path: "",
        stream: null as any,
      };

      // Mock processor to return data with duplicates
      const csvProcessorService = module.get<CsvXlsxProcessorService>(CsvXlsxProcessorService);
      const mockProcessedData = [
        { name: "John", surname: "Doe", email: "duplicate@example.com", role: USER_ROLES.STUDENT },
        { name: "Jane", surname: "Smith", email: "duplicate@example.com", role: USER_ROLES.ADMIN },
      ];

      jest.spyOn(csvProcessorService, "processUserImportFile").mockResolvedValue(mockProcessedData);

      // Execute import
      const result = await controller.importUsers({ data: { validateOnly: false } }, mockFile);

      // Verify error response for duplicates
      expect(result.data.message).toBe("Import validation failed");
      expect(result.data.errors).toBeDefined();
      expect(result.data.errors.some((e) => e.message.includes("Duplicate email"))).toBe(true);

      // Verify no users created
      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(0);
    });
  });

  describe("Transaction Rollback Testing", () => {
    it("should rollback database transaction on email service failure", async () => {
      // Mock email service to fail
      emailService.sendEmail.mockRejectedValue(new Error("Email service failed"));

      const csvFilePath = path.join(testFixturesPath, "users-valid.csv");
      const csvBuffer = fs.readFileSync(csvFilePath);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "users-valid.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        buffer: csvBuffer,
        size: csvBuffer.length,
        destination: "",
        filename: "",
        path: "",
        stream: null as any,
      };

      const csvProcessorService = module.get<CsvXlsxProcessorService>(CsvXlsxProcessorService);
      const mockProcessedData = [
        { name: "John", surname: "Doe", email: "john.doe@example.com", role: USER_ROLES.STUDENT },
      ];

      jest.spyOn(csvProcessorService, "processUserImportFile").mockResolvedValue(mockProcessedData);

      // Execute import and expect failure
      await expect(
        controller.importUsers({ data: { validateOnly: false } }, mockFile),
      ).rejects.toThrow("Email service failed");

      // Verify transaction rollback - no users should be created
      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(0);

      // Verify no create tokens created
      const allTokens = await db.select().from(createTokens);
      expect(allTokens).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should throw BadRequestException when no file provided", async () => {
      await expect(
        controller.importUsers({ data: { validateOnly: false } }, null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should handle file processing errors gracefully", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "invalid.csv",
        encoding: "7bit",
        mimetype: "text/csv",
        buffer: Buffer.from("invalid content"),
        size: 15,
        destination: "",
        filename: "",
        path: "",
        stream: null as any,
      };

      // Mock processor to throw error
      const csvProcessorService = module.get<CsvXlsxProcessorService>(CsvXlsxProcessorService);
      jest
        .spyOn(csvProcessorService, "processUserImportFile")
        .mockRejectedValue(new Error("Invalid file format"));

      await expect(
        controller.importUsers({ data: { validateOnly: false } }, mockFile),
      ).rejects.toThrow("Invalid file format");

      // Verify no database changes
      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(0);
    });
  });
});
