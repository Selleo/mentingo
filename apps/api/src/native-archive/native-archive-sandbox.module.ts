import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { CacheModule } from "src/cache/cache.module";
import { getAppConfigLoaders } from "src/common/configuration/app-config-loaders";
import { jwtModuleOptions } from "src/common/configuration/jwt-module-options";
import { ContentMarketplaceLineageRepository } from "src/content-marketplace/repositories/content-marketplace-lineage.repository";
import { ContentMarketplaceClientService } from "src/content-marketplace/services/content-marketplace-client.service";
import { ContentMarketplaceService } from "src/content-marketplace/services/content-marketplace.service";
import { EnvModule } from "src/env/env.module";
import { OutboxModule } from "src/outbox/outbox.module";
import { QueueModule } from "src/queue/queue.module";
import { RedisClientsModule } from "src/redis";
import { DbModule } from "src/storage/db/db.module";

import { NativeArchiveModule } from "./native-archive.module";

/**
 * The Nest context of the native-archive queue sandbox: only what fulfilling an archive job needs,
 * without HTTP, sockets, crons, or other queues' workers. The content marketplace service is
 * included because it registers the downloader that marketplace imports fetch their archive with.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ load: getAppConfigLoaders(), isGlobal: true }),
    JwtModule.registerAsync(jwtModuleOptions),
    DbModule,
    RedisClientsModule,
    CacheModule,
    EnvModule,
    QueueModule,
    OutboxModule,
    NativeArchiveModule,
  ],
  providers: [
    ContentMarketplaceClientService,
    ContentMarketplaceLineageRepository,
    ContentMarketplaceService,
  ],
})
export class NativeArchiveSandboxModule {}
