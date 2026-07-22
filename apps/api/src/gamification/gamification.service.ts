import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { userProgress } from "src/storage/schema";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class GamificationService {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}
  async getUserProgress(currentUser: CurrentUserType) {
    const [progress] = await this.db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, currentUser.userId));

    if (!progress) {
      throw new NotFoundException("common.error");
    }

    return progress;
  }
}
