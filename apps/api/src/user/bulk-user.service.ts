import { ConflictException, Inject, Injectable, BadRequestException } from "@nestjs/common";
import { CreatePasswordEmail } from "@repo/email-templates";
import { inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { createTokens, users, userDetails } from "src/storage/schema";

import { USER_ROLES } from "./schemas/userRoles";

import type { ImportUserRow, ValidationError } from "./schemas/userImport.schema";

export interface BulkUserCreationResult {
  createdUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }>;
  successCount: number;
  totalRows: number;
}

@Injectable()
export class BulkUserService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private emailService: EmailService,
  ) {}

  /**
   * Creates multiple users in a transaction with proper error handling
   * All users must be valid or none will be created (all-or-nothing)
   */
  public async createUsersInBulk(userRows: ImportUserRow[]): Promise<BulkUserCreationResult> {
    if (userRows.length === 0) {
      throw new BadRequestException("No users provided for import");
    }

    // Validate all users before any database operations
    await this.validateUsersForCreation(userRows);

    return await this.db.transaction(async (trx) => {
      const createdUsers: BulkUserCreationResult["createdUsers"] = [];

      for (const userRow of userRows) {
        // Map CSV columns to database schema
        const userData = {
          firstName: userRow.name,
          lastName: userRow.surname,
          email: userRow.email.toLowerCase(),
          role: userRow.role,
        };

        // Insert user
        const [createdUser] = await trx.insert(users).values(userData).returning();

        // Generate password creation token
        const token = nanoid(64);
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24); // 24 hour expiry

        await trx.insert(createTokens).values({
          userId: createdUser.id,
          createToken: token,
          expiryDate,
          reminderCount: 0,
        });

        // Create user details entry for content creators and admins
        if (
          createdUser.role === USER_ROLES.CONTENT_CREATOR ||
          createdUser.role === USER_ROLES.ADMIN
        ) {
          await trx.insert(userDetails).values({
            userId: createdUser.id,
            contactEmail: createdUser.email,
          });
        }

        // Send welcome email with password creation link
        await this.sendWelcomeEmail(createdUser, token);

        createdUsers.push({
          id: createdUser.id,
          email: createdUser.email,
          firstName: createdUser.firstName,
          lastName: createdUser.lastName,
          role: createdUser.role,
        });
      }

      return {
        createdUsers,
        successCount: createdUsers.length,
        totalRows: userRows.length,
      };
    });
  }

  /**
   * Validates that all users can be created (no duplicates, valid data)
   * Throws ConflictException if any validation fails
   */
  private async validateUsersForCreation(userRows: ImportUserRow[]): Promise<void> {
    const emails = userRows.map((user) => user.email.toLowerCase());

    // Check for duplicate emails within the import
    const emailSet = new Set(emails);
    if (emailSet.size !== emails.length) {
      const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index);
      throw new ConflictException(
        `Duplicate emails found in import: ${[...new Set(duplicates)].join(", ")}`,
      );
    }

    // Check for existing users in database
    const existingUsers = await this.db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.email, emails));

    if (existingUsers.length > 0) {
      const existingEmails = existingUsers.map((user) => user.email);
      throw new ConflictException(
        `Users with following emails already exist: ${existingEmails.join(", ")}`,
      );
    }
  }

  /**
   * Sends welcome email with password creation link
   */
  private async sendWelcomeEmail(
    user: { email: string; firstName: string; role: string },
    token: string,
  ): Promise<void> {
    const url = `${process.env.CORS_ORIGIN}/auth/create-new-password?createToken=${token}&email=${user.email}`;

    const { text, html } = new CreatePasswordEmail({
      name: user.firstName,
      role: user.role,
      createPasswordLink: url,
    });

    await this.emailService.sendEmail({
      to: user.email,
      subject: "Welcome to the Platform!",
      text,
      html,
      from: process.env.SES_EMAIL || "",
    });
  }

  /**
   * Validates individual user data and returns validation errors
   * Used by ImportValidationService for comprehensive validation
   */
  public async validateUserRows(userRows: ImportUserRow[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check for existing users
    const emails = userRows.map((user) => user.email.toLowerCase());
    const existingUsers = await this.db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.email, emails));

    const existingEmailSet = new Set(existingUsers.map((user) => user.email));

    // Validate each row
    userRows.forEach((userRow, index) => {
      const rowNumber = index + 1;

      // Check for existing email
      if (existingEmailSet.has(userRow.email.toLowerCase())) {
        errors.push({
          row: rowNumber,
          field: "email",
          value: userRow.email,
          message: "User with this email already exists",
        });
      }
    });

    // Check for duplicates within the import
    const emailCounts = new Map<string, number[]>();
    emails.forEach((email, index) => {
      if (!emailCounts.has(email)) {
        emailCounts.set(email, []);
      }
      emailCounts.get(email)!.push(index + 1);
    });

    emailCounts.forEach((rowNumbers, email) => {
      if (rowNumbers.length > 1) {
        rowNumbers.forEach((rowNumber) => {
          errors.push({
            row: rowNumber,
            field: "email",
            value: email,
            message: `Duplicate email found in rows: ${rowNumbers.join(", ")}`,
          });
        });
      }
    });

    return errors;
  }
}
