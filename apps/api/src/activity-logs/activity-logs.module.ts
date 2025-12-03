import { Module } from "@nestjs/common";

import { ActivityLogsService } from "./activity-logs.service";

@Module({
  providers: [ActivityLogsService],
})
export class ActivityLogsModule {}
