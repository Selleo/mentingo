import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gte } from "drizzle-orm";

import { DatabasePg } from "src/common";
import hashPassword from "src/common/helpers/hashPassword";
import { createTokens, credentials } from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class CreatePasswordService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getOneByToken(token: string) {
    const [createToken] = await this.db
      .select()
      .from(createTokens)
      .where(and(eq(createTokens.createToken, token), gte(createTokens.expiryDate, new Date())));

    if (!createToken) throw new NotFoundException("Invalid token");

    return createToken;
  }

  public async deleteToken(token: string) {
    const [deletedToken] = await this.db
      .delete(createTokens)
      .where(eq(createTokens.createToken, token))
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
