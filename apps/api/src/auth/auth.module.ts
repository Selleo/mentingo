import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { ResendVerificationMailCron } from "src/auth/resend-verification-mail-cron";
import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";
import { UserService } from "src/user/user.service";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CreatePasswordService } from "./create-password.service";
import { ResetPasswordService } from "./reset-password.service";
import { GoogleStrategy } from "./strategy/google.strategy";
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
    FileService,
    S3Service,
    ...(process.env.GOOGLE_OAUTH_ENABLED === "true" ? [GoogleStrategy] : []),
    SettingsService,
  ],
  exports: [],
})
export class AuthModule {}
