import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { ResendVerificationMailCron } from "src/auth/resend-verification-mail-cron";
import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { EmailModule } from "src/common/emails/emails.module";
import { GoogleOAuthGuard } from "src/common/guards/google-oauth.guard";
import { MicrosoftOAuthGuard } from "src/common/guards/microsoft-oauth.guard";
import { FileService } from "src/file/file.service";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StatisticsService } from "src/statistics/statistics.service";
import { UserService } from "src/user/user.service";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CreatePasswordService } from "./create-password.service";
import { ResetPasswordService } from "./reset-password.service";
import { GoogleStrategy } from "./strategy/google.strategy";
import { JwtStrategy } from "./strategy/jwt.strategy";
import { LocalStrategy } from "./strategy/local.strategy";
import { MicrosoftStrategy } from "./strategy/microsoft.strategy";
import { TokenService } from "./token.service";

@Module({
  imports: [PassportModule, EmailModule, StatisticsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserService,
    StatisticsService,
    TokenService,
    JwtStrategy,
    LocalStrategy,
    CreatePasswordService,
    ResetPasswordService,
    ResendVerificationMailCron,
    FileService,
    S3Service,
    BunnyStreamService,
    GoogleStrategy,
    MicrosoftStrategy,
    GoogleOAuthGuard,
    MicrosoftOAuthGuard,
    SettingsService,
  ],
  exports: [CreatePasswordService],
})
export class AuthModule {}
