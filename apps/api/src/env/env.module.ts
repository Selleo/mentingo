import { Global, Module } from "@nestjs/common";

import { EnvController } from "src/env/env.controller";
import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";

@Global()
@Module({
  controllers: [EnvController],
  providers: [EnvService, EnvRepository],
  exports: [EnvService],
})
export class EnvModule {}
