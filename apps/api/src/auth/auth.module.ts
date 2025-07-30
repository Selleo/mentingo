import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { ResendVerificationMailCron } from "src/auth/resend-verification-mail-cron";
import { ChapterModule } from "src/chapter/chapter.module";
import { ChapterService } from "src/chapter/chapter.service";
import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { LessonModule } from "src/lesson/lesson.module";
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
  imports: [PassportModule, EmailModule, StatisticsModule, ChapterModule, LessonModule],
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
    ...(process.env.GOOGLE_OAUTH_ENABLED === "true" ? [GoogleStrategy] : []),
    ...(process.env.MICROSOFT_OAUTH_ENABLED === "true" ? [MicrosoftStrategy] : []),
    SettingsService,
    ChapterService,
  ],
  exports: [],
})
export class AuthModule {}
