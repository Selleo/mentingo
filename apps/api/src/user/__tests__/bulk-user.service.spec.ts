import { ConflictException, BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { EmailService } from "src/common/emails/emails.service";

import { BulkUserService } from "../bulk-user.service";
import { USER_ROLES } from "../schemas/userRoles";

import type { ImportUserRow } from "../schemas/userImport.schema";
import type { TestingModule } from "@nestjs/testing";
import type { DatabasePg } from "src/common";

describe("BulkUserService", () => {
  let service: BulkUserService;
  let mockDb: jest.Mocked<DatabasePg>;
  let mockEmailService: jest.Mocked<EmailService>;

  const mockTransaction = jest.fn();
  const mockSelect = jest.fn();
  const mockInsert = jest.fn();
  const mockFrom = jest.fn();
  const mockWhere = jest.fn();
  const mockReturning = jest.fn();
  const mockValues = jest.fn();

  beforeEach(async () => {
    const mockDbMethods = {
      select: mockSelect,
      insert: mockInsert,
      transaction: mockTransaction,
    };

    const mockQueryBuilder = {
      from: mockFrom,
      where: mockWhere,
      returning: mockReturning,
      values: mockValues,
    };

    // Setup method chaining
    mockSelect.mockReturnValue(mockQueryBuilder);
    mockInsert.mockReturnValue(mockQueryBuilder);
    mockFrom.mockReturnValue(mockQueryBuilder);
    mockWhere.mockReturnValue(mockQueryBuilder);
    mockValues.mockReturnValue(mockQueryBuilder);
    mockReturning.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkUserService,
        {
          provide: "DB",
          useValue: mockDbMethods,
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BulkUserService>(BulkUserService);
    mockDb = module.get("DB");
    mockEmailService = module.get<EmailService>(EmailService) as jest.Mocked<EmailService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createUsersInBulk", () => {
    const validUserRows: ImportUserRow[] = [
      {
        name: "John",
        surname: "Doe",
        email: "john.doe@example.com",
        role: USER_ROLES.STUDENT,
      },
      {
        name: "Jane",
        surname: "Smith",
        email: "jane.smith@example.com",
        role: USER_ROLES.CONTENT_CREATOR,
      },
    ];

    it("should create users successfully", async () => {
      // Mock no existing users (after the WHERE clause)
      mockWhere.mockResolvedValue([]);

      // Mock transaction
      const mockTrx = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              {
                id: "user-1",
                email: "john.doe@example.com",
                firstName: "John",
                lastName: "Doe",
                role: USER_ROLES.STUDENT,
              },
            ]),
          }),
        }),
      };

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      mockEmailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.createUsersInBulk([validUserRows[0]], true);

      expect(result.successCount).toBe(1);
      expect(result.totalRows).toBe(1);
      expect(result.createdUsers).toHaveLength(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it("should throw ConflictException for duplicate emails within import", async () => {
      const duplicateUsers: ImportUserRow[] = [
        validUserRows[0],
        { ...validUserRows[0], name: "Different Name" }, // Same email
      ];

      await expect(service.createUsersInBulk(duplicateUsers)).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException for existing users in database", async () => {
      // Mock existing user found
      mockWhere.mockResolvedValue([{ email: "john.doe@example.com" }]);

      await expect(service.createUsersInBulk([validUserRows[0]])).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw BadRequestException for empty user list", async () => {
      await expect(service.createUsersInBulk([])).rejects.toThrow(BadRequestException);
    });
  });

  describe("validateUserRows", () => {
    it("should return validation errors for existing users", async () => {
      const userRows: ImportUserRow[] = [
        {
          name: "Existing",
          surname: "User",
          email: "existing@example.com",
          role: USER_ROLES.STUDENT,
        },
      ];

      // Mock existing user found
      mockWhere.mockResolvedValue([{ email: "existing@example.com" }]);

      const errors = await service.validateUserRows(userRows);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("already exists");
      expect(errors[0].field).toBe("email");
    });

    it("should return duplicate email errors within import", async () => {
      const userRows: ImportUserRow[] = [
        {
          name: "User1",
          surname: "Test",
          email: "duplicate@example.com",
          role: USER_ROLES.STUDENT,
        },
        {
          name: "User2",
          surname: "Test",
          email: "duplicate@example.com",
          role: USER_ROLES.ADMIN,
        },
      ];

      // Mock no existing users in database
      mockWhere.mockResolvedValue([]);

      const errors = await service.validateUserRows(userRows);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes("Duplicate email"))).toBe(true);
    });

    it("should return empty errors for valid unique users", async () => {
      const userRows: ImportUserRow[] = [
        {
          name: "Valid",
          surname: "User",
          email: "valid@example.com",
          role: USER_ROLES.STUDENT,
        },
      ];

      // Mock no existing users
      mockWhere.mockResolvedValue([]);

      const errors = await service.validateUserRows(userRows);

      expect(errors).toHaveLength(0);
    });
  });
});
