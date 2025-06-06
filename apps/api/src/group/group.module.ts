import { Module } from "@nestjs/common";

import { GroupController } from "src/group/group.controller";
import { GroupService } from "src/group/group.service";

@Module({
  imports: [],
  controllers: [GroupController],
  providers: [GroupService],
  exports: [],
})
export class GroupModule {}
