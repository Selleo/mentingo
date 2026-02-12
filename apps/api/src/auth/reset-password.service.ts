import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { resetTokens, users } from "src/storage/schema";

@Injectable()
export class ResetPasswordService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getOneByTokenAndEmail(token: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const [resetToken] = await this.db
      .select({ tokenRecord: resetTokens })
      .from(resetTokens)
      .innerJoin(users, eq(users.id, resetTokens.userId))
      .where(
        and(
          eq(resetTokens.resetToken, token),
          gte(resetTokens.expiryDate, new Date()),
          sql`lower(${users.email}) = ${normalizedEmail}`,
        ),
      );

    if (!resetToken) throw new NotFoundException("createPasswordView.error.invalidTokenOrEmail");

    return resetToken.tokenRecord;
  }

  public async deleteToken(token: string) {
    const [deletedToken] = await this.db
      .delete(resetTokens)
      .where(eq(resetTokens.resetToken, token))
      .returning();

    if (!deletedToken) throw new NotFoundException("Token not found");
  }
}
