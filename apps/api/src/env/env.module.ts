import { forwardRef, Global, Module } from "@nestjs/common";

import { EnvController } from "src/env/env.controller";
import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";
import { SettingsModule } from "src/settings/settings.module";

@Global()
@Module({
  controllers: [EnvController],
  imports: [forwardRef(() => SettingsModule)],
  providers: [EnvService, EnvRepository],
  exports: [EnvService],
})
export class EnvModule {}
