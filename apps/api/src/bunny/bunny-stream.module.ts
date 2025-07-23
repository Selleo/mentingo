import { Module } from "@nestjs/common";

import { BunnyStreamService } from "src/bunny/bunny-stream.service";

@Module({
  imports: [],
  controllers: [],
  providers: [BunnyStreamService],
  exports: [BunnyStreamService],
})
export class BunnyStreamModule {}
