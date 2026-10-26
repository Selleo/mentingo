import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import databaseConfiguration from "../../common/configuration/database";

import { DatabaseMigrationRepository } from "./database-migration.repository";

@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(private readonly databaseMigrationRepository: DatabaseMigrationRepository) {}

  async runMigrations() {
    this.logger.log("Running Core and Workflow database migrations");
    try {
      await this.databaseMigrationRepository.runMigrations();
      this.logger.log("Database migrations completed");
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : "Database migrations failed");
      throw error;
    }
  }
}

/** Standalone migration entry: no AppModule, servers or AI providers are loaded. */
export async function runDatabaseMigrations() {
  const config = new ConfigService({ database: databaseConfiguration() });
  await new DatabaseMigrationService(new DatabaseMigrationRepository(config)).runMigrations();
}
