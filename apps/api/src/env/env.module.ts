import { forwardRef, Global, Module } from "@nestjs/common";

import { EnvController } from "src/env/env.controller";
import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";
import { LegacySSOEnforcementBackfillService } from "src/env/services/legacy-sso-enforcement-backfill.service";
import { LoginMethodsService } from "src/env/services/login-methods.service";
import { SettingsModule } from "src/settings/settings.module";

@Global()
@Module({
  controllers: [EnvController],
  imports: [forwardRef(() => SettingsModule)],
  providers: [EnvService, EnvRepository, LoginMethodsService, LegacySSOEnforcementBackfillService],
  exports: [EnvService, LoginMethodsService, LegacySSOEnforcementBackfillService],
})
export class EnvModule {}
