import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, and, gte } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { resetTokens } from "src/storage/schema";

@Injectable()
export class ResetPasswordService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getOneByToken(token: string) {
    const [resetToken] = await this.db
      .select()
      .from(resetTokens)
      .where(and(eq(resetTokens.resetToken, token), gte(resetTokens.expiryDate, new Date())));

    if (!resetToken) throw new NotFoundException("Invalid token");

    return resetToken;
  }

  public async deleteToken(token: string) {
    const [deletedToken] = await this.db
      .delete(resetTokens)
      .where(eq(resetTokens.resetToken, token))
      .returning();

    if (!deletedToken) throw new NotFoundException("Token not found");
  }
}
