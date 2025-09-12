import { Test } from "@nestjs/testing";

import { BulkUserService } from "../bulk-user.service";
import { ImportValidationService } from "../import-validation.service";
import { USER_ROLES } from "../schemas/userRoles";

import type { ImportUserRow } from "../schemas/userImport.schema";
import type { TestingModule } from "@nestjs/testing";

describe("ImportValidationService", () => {
  let service: ImportValidationService;
  let mockBulkUserService: jest.Mocked<BulkUserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportValidationService,
        {
          provide: BulkUserService,
          useValue: {
            validateUserRows: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ImportValidationService>(ImportValidationService);
    mockBulkUserService = module.get<BulkUserService>(
      BulkUserService,
    ) as jest.Mocked<BulkUserService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateImport", () => {
    it("should return invalid for empty user rows", async () => {
      const result = await service.validateImport([]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("no user data");
    });

    it("should validate successful import with valid data", async () => {
      const validUserRows: ImportUserRow[] = [
        {
          name: "John",
          surname: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.STUDENT,
        },
      ];

      mockBulkUserService.validateUserRows.mockResolvedValue([]);

      const result = await service.validateImport(validUserRows);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(1);
    });

    it("should return validation errors for missing required fields", async () => {
      const invalidUserRows: ImportUserRow[] = [
        {
          name: "",
          surname: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.STUDENT,
        },
        {
          name: "Jane",
          surname: "",
          email: "invalid-email",
          role: USER_ROLES.STUDENT,
        },
      ];

      mockBulkUserService.validateUserRows.mockResolvedValue([]);

      const result = await service.validateImport(invalidUserRows);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Check for name validation error
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
      // Check for surname validation error
      expect(result.errors.some((e) => e.field === "surname")).toBe(true);
      // Check for email format validation error
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    });

    it("should return validation errors for invalid role", async () => {
      const invalidUserRows: ImportUserRow[] = [
        {
          name: "John",
          surname: "Doe",
          email: "john.doe@example.com",
          role: "invalid_role" as any,
        },
      ];

      mockBulkUserService.validateUserRows.mockResolvedValue([]);

      const result = await service.validateImport(invalidUserRows);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "role")).toBe(true);
    });

    it("should return validation errors for field length violations", async () => {
      const invalidUserRows: ImportUserRow[] = [
        {
          name: "A".repeat(65), // Too long (>64 characters)
          surname: "B".repeat(65), // Too long
          email: "valid@example.com",
          role: USER_ROLES.STUDENT,
        },
      ];

      mockBulkUserService.validateUserRows.mockResolvedValue([]);

      const result = await service.validateImport(invalidUserRows);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
      expect(result.errors.some((e) => e.field === "surname")).toBe(true);
    });

    it("should combine field validation errors with uniqueness errors", async () => {
      const invalidUserRows: ImportUserRow[] = [
        {
          name: "John",
          surname: "", // Invalid field
          email: "john.doe@example.com",
          role: USER_ROLES.STUDENT,
        },
      ];

      // Mock uniqueness validation returning errors
      mockBulkUserService.validateUserRows.mockResolvedValue([
        {
          row: 1,
          field: "email",
          value: "john.doe@example.com",
          message: "User with this email already exists",
        },
      ]);

      const result = await service.validateImport(invalidUserRows);

      expect(result.isValid).toBe(false);
      // Should have both field validation error and uniqueness error
      expect(result.errors.some((e) => e.field === "surname")).toBe(true);
      expect(
        result.errors.some((e) => e.field === "email" && e.message.includes("already exists")),
      ).toBe(true);
    });
  });

  describe("email validation", () => {
    it("should validate various email formats", async () => {
      const testCases = [
        { email: "valid@example.com", shouldPass: true },
        { email: "user.name@example.co.uk", shouldPass: true },
        { email: "user+tag@example.org", shouldPass: true },
        { email: "invalid.email", shouldPass: false },
        { email: "@example.com", shouldPass: false },
        { email: "user@", shouldPass: false },
        { email: "", shouldPass: false },
      ];

      mockBulkUserService.validateUserRows.mockResolvedValue([]);

      for (const testCase of testCases) {
        const userRows: ImportUserRow[] = [
          {
            name: "Test",
            surname: "User",
            email: testCase.email,
            role: USER_ROLES.STUDENT,
          },
        ];

        const result = await service.validateImport(userRows);
        const hasEmailError = result.errors.some((e) => e.field === "email");

        if (testCase.shouldPass) {
          expect(hasEmailError).toBe(false);
        } else {
          expect(hasEmailError).toBe(true);
        }
      }
    });
  });
});
