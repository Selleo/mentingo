import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import helpdeskConfig from "src/common/configuration/self-onboarding";
import { SettingsModule } from "src/settings/settings.module";

import { createHelpdeskSdkClient } from "./self-onboarding-client.provider";
import { HelpdeskClientService } from "./self-onboarding-client.service";
import { HelpdeskController } from "./self-onboarding.controller";
import { HelpdeskService } from "./self-onboarding.service";
import { HELPDESK_CLIENT } from "./self-onboarding.types";

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
