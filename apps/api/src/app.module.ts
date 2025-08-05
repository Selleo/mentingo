import { DrizzlePostgresModule } from "@knaadh/nestjs-drizzle-postgres";
import { Module } from "@nestjs/common";
import { ConditionalModule, ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { MulterModule } from "@nestjs/platform-express";
import { ScheduleModule } from "@nestjs/schedule";

import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { GoogleStrategy } from "./auth/strategy/google.strategy";
import { MicrosoftStrategy } from "./auth/strategy/microsoft.strategy";
import { CacheModule } from "./cache/cache.module";
import { CategoryModule } from "./category/category.module";
import awsConfig from "./common/configuration/aws";
import database from "./common/configuration/database";
import emailConfig from "./common/configuration/email";
import jwtConfig from "./common/configuration/jwt";
import microsoftConfig from "./common/configuration/microsoft";
import redisConfig from "./common/configuration/redis";
import s3Config from "./common/configuration/s3";
import stripeConfig from "./common/configuration/stripe";
import { EmailModule } from "./common/emails/emails.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { StagingGuard } from "./common/guards/staging.guard";
import { CourseModule } from "./courses/course.module";
import { EventsModule } from "./events/events.module";
import { FileModule } from "./file/files.module";
import { GroupModule } from "./group/group.module";
import { HealthModule } from "./health/health.module";
import { LessonModule } from "./lesson/lesson.module";
import { QuestionsModule } from "./questions/question.module";
import { S3Module } from "./s3/s3.module";
import { ScormModule } from "./scorm/scorm.module";
import { SentryInterceptor } from "./sentry/sentry.interceptor";
import { SettingsModule } from "./settings/settings.module";
import { StatisticsModule } from "./statistics/statistics.module";
import * as schema from "./storage/schema";
import { StripeModule } from "./stripe/stripe.module";
import { StudentLessonProgressModule } from "./studentLessonProgress/studentLessonProgress.module";
import { TestConfigModule } from "./test-config/test-config.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [
        database,
        jwtConfig,
        emailConfig,
        awsConfig,
        s3Config,
        microsoftConfig,
        stripeConfig,
        redisConfig,
      ],
      isGlobal: true,
    }),
    DrizzlePostgresModule.registerAsync({
      tag: "DB",
      useFactory(configService: ConfigService) {
        return {
          postgres: {
            url: configService.get<string>("database.url")!,
          },
          config: {
            schema: { ...schema },
          },
        };
      },
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      useFactory(configService: ConfigService) {
        return {
          secret: configService.get<string>("jwt.secret")!,
          signOptions: {
            expiresIn: configService.get<string>("jwt.expirationTime"),
          },
        };
      },
      inject: [ConfigService],
      global: true,
    }),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
    AuthModule,
    HealthModule,
    UserModule,
    EmailModule,
    TestConfigModule,
    CategoryModule,
    ConditionalModule.registerWhen(ScheduleModule.forRoot(), (env) => env.NODE_ENV !== "test"),
    CourseModule,
    GroupModule,
    LessonModule,
    QuestionsModule,
    StudentLessonProgressModule,
    FileModule,
    S3Module,
    StripeModule,
    EventsModule,
    StatisticsModule,
    ScormModule,
    CacheModule,
    AiModule,
    SettingsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: StagingGuard,
    },
    ...(process.env.GOOGLE_OAUTH_ENABLED === "true" ? [GoogleStrategy] : []),
    ...(process.env.MICROSOFT_OAUTH_ENABLED === "true" ? [MicrosoftStrategy] : []),
  ],
})
export class AppModule {}
