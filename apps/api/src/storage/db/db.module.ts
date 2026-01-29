import { DrizzlePostgresModule } from "@knaadh/nestjs-drizzle-postgres";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import * as schema from "src/storage/schema";

import { createDbProxy, DB, DB_BASE } from "./db.providers";
import { TenantDbRunnerService } from "./tenant-db-runner.service";
import { TenantResolverService } from "./tenant-resolver.service";

import type { DatabasePg } from "src/common";

@Global()
@Module({
  imports: [
    ConfigModule,
    DrizzlePostgresModule.registerAsync({
      tag: DB_BASE,
      useFactory(configService: ConfigService) {
        return {
          postgres: {
            url: configService.get<string>("database.url")!,
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
      inject: [DB_BASE],
      useFactory: (dbBase: DatabasePg) => createDbProxy(dbBase),
    },
    TenantDbRunnerService,
    TenantResolverService,
  ],
  exports: [DB, TenantDbRunnerService, TenantResolverService, DrizzlePostgresModule],
})
export class DbModule {}
