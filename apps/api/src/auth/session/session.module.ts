import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { MfaRepository } from "./mfa.repository";
import { SessionService } from "./session.service";

@Global()
@Module({
  imports: [CqrsModule],
  providers: [MfaRepository, SessionService],
  exports: [SessionService],
})
export class SessionModule {}
