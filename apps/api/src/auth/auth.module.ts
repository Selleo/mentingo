import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { ResendVerificationMailCron } from "src/auth/resend-verification-mail-cron";
import { EmailModule } from "src/common/emails/emails.module";
import { SettingsService } from "src/settings/settings.service";
import { UserService } from "src/user/user.service";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CreatePasswordService } from "./create-password.service";
import { ResetPasswordService } from "./reset-password.service";
import { JwtStrategy } from "./strategy/jwt.strategy";
import { LocalStrategy } from "./strategy/local.strategy";
import { TokenService } from "./token.service";

@Module({
  imports: [PassportModule, EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserService,
    TokenService,
    JwtStrategy,
    LocalStrategy,
    CreatePasswordService,
    ResetPasswordService,
    ResendVerificationMailCron,
    SettingsService,
  ],
  exports: [],
})
export class AuthModule {}
