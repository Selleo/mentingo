import { DrizzlePostgresModule } from "@knaadh/nestjs-drizzle-postgres";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { TokenService } from "src/auth/token.service";
import * as schema from "src/storage/schema";

import { DatabaseMigrationService } from "./database-migration.service";
import { DB, DB_APP, DB_ADMIN } from "./db.providers";
import { createTenantAwareDb } from "./tenant-aware-session";
import { TenantDbRunnerService } from "./tenant-db-runner.service";
import { TenantResolverService } from "./tenant-resolver.service";
import { TenantStateService } from "./tenant-state.service";

import type { DatabasePg } from "src/common";

@Global()
@Module({
  imports: [
    ConfigModule,
    DrizzlePostgresModule.registerAsync({
      tag: DB_ADMIN,
      useFactory(configService: ConfigService) {
        return {
          postgres: {
            url: configService.get<string>("database.urlAdmin")!,
          },
          config: {
            schema: { ...schema },
          },
        };
      },
      inject: [ConfigService],
    }),
    DrizzlePostgresModule.registerAsync({
      tag: DB_APP,
      useFactory(configService: ConfigService) {
        return {
          postgres: {
            url: configService.get<string>("database.urlApp")!,
          },
          config: {
            schema: { ...schema },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: DB,
      inject: [DB_APP, TenantDbRunnerService],
      useFactory: (dbApp: DatabasePg, runner: TenantDbRunnerService) =>
        createTenantAwareDb(dbApp, runner),
    },
    DatabaseMigrationService,
    TenantDbRunnerService,
    TenantResolverService,
    TenantStateService,
    TokenService,
  ],
  exports: [
    DB,
    DatabaseMigrationService,
    TenantDbRunnerService,
    TenantResolverService,
    TenantStateService,
    DrizzlePostgresModule,
  ],
})
export class DbModule {}
