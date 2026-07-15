import { Inject, Injectable } from "@nestjs/common";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";

@Injectable()
export class AutomationsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async createAutomation() {}
}
