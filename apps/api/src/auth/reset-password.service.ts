import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gte } from "drizzle-orm";

import { hashToken } from "src/auth/utils/hash-auth-token";
import { DatabasePg, type UUIDType } from "src/common";
import { resetTokens } from "src/storage/schema";

@Injectable()
export class ResetPasswordService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getOneByToken(token: string) {
    const hashedToken = hashToken(token);

    const [resetToken] = await this.db
      .select()
      .from(resetTokens)
      .where(and(eq(resetTokens.tokenHash, hashedToken), gte(resetTokens.expiryDate, new Date())));

    if (!resetToken) throw new NotFoundException("createPasswordView.error.invalidToken");

    return resetToken;
  }

  public async deleteToken(tokenId: UUIDType) {
    const [deletedToken] = await this.db
      .delete(resetTokens)
      .where(eq(resetTokens.id, tokenId))
      .returning();

    if (!deletedToken) throw new NotFoundException("Token not found");
  }
}
