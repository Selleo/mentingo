import { join } from "node:path";

import { Inject, Injectable, Logger } from "@nestjs/common";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { DatabasePg } from "src/common";

import { DB_ADMIN } from "./db.providers";

const MIGRATIONS_FOLDER = join(__dirname, "../migrations");

@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(@Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg) {}

  async runMigrations() {
    this.logger.log("Running database migrations");

    await migrate(this.dbAdmin, { migrationsFolder: MIGRATIONS_FOLDER });

    this.logger.log("Database migrations completed");
  }
}
