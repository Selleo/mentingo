import { Global, Module } from "@nestjs/common";

import { MfaRepository } from "./mfa.repository";
import { SessionService } from "./session.service";

@Global()
@Module({ providers: [MfaRepository, SessionService], exports: [SessionService] })
export class SessionModule {}
