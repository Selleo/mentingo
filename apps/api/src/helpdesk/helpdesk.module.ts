import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import helpdeskConfig from "src/common/configuration/helpdesk";
import { SettingsModule } from "src/settings/settings.module";

import { createHelpdeskSdkClient } from "./helpdesk-client.provider";
import { HelpdeskClientService } from "./helpdesk-client.service";
import { HelpdeskController } from "./helpdesk.controller";
import { HelpdeskService } from "./helpdesk.service";
import { HELPDESK_CLIENT } from "./helpdesk.types";

@Module({
  imports: [ConfigModule.forFeature(helpdeskConfig), SettingsModule],
  controllers: [HelpdeskController],
  providers: [
    {
      provide: HELPDESK_CLIENT,
      useFactory: createHelpdeskSdkClient,
      inject: [helpdeskConfig.KEY],
    },
    HelpdeskClientService,
    HelpdeskService,
  ],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
