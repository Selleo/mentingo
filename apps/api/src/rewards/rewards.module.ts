import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { WebSocketModule } from "src/websocket";

import { RewardsController } from "./rewards.controller";
import { RewardsHandler } from "./rewards.handler";
import { RewardsService } from "./rewards.service";

@Module({
  imports: [FileModule, WebSocketModule],
  controllers: [RewardsController],
  providers: [RewardsService, RewardsHandler],
  exports: [RewardsService],
})
export class RewardsModule {}
