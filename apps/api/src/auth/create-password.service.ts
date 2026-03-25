import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";

import { hashToken } from "src/auth/utils/hash-auth-token";
import { DatabasePg } from "src/common";
import hashPassword from "src/common/helpers/hashPassword";
import { createTokens, credentials, users } from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class CreatePasswordService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getOneByTokenAndEmail(token: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const hashedToken = hashToken(token);

    const [createToken] = await this.db
      .select({ tokenRecord: createTokens })
      .from(createTokens)
      .innerJoin(users, eq(users.id, createTokens.userId))
      .where(
        and(
          eq(createTokens.createToken, hashedToken),
          gte(createTokens.expiryDate, new Date()),
          sql`lower(${users.email}) = ${normalizedEmail}`,
        ),
      );

    if (!createToken) throw new NotFoundException("createPasswordView.error.invalidTokenOrEmail");

    return createToken.tokenRecord;
  }

  public async deleteToken(tokenId: UUIDType) {
    const [deletedToken] = await this.db
      .delete(createTokens)
      .where(eq(createTokens.id, tokenId))
      .returning();

    if (!deletedToken) throw new NotFoundException("Token not found");
  }

  public async createUserPassword(userId: UUIDType, password: string) {
    const hashedPassword = await hashPassword(password);

    const [createdCredentials] = await this.db
      .insert(credentials)
      .values({ userId, password: hashedPassword })
      .returning();

    if (!createdCredentials) throw new NotFoundException("Failed to create user password");
  }
}
