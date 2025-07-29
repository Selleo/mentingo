import { Module } from "@nestjs/common";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";

@Module({
  imports: [],
  controllers: [],
  providers: [BunnyStreamService],
  exports: [BunnyStreamService],
})
export class BunnyStreamModule {}
