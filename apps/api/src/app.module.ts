import { DrizzlePostgresModule } from "@knaadh/nestjs-drizzle-postgres";
import { Module } from "@nestjs/common";
import { ConditionalModule, ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { MulterModule } from "@nestjs/platform-express";
import { ScheduleModule } from "@nestjs/schedule";

import { ActivityLogsModule } from "src/activity-logs/activity-logs.module";
import { EnvModule } from "src/env/env.module";
import { LearningTimeModule } from "src/learning-time";
import { QAModule } from "src/qa/qa.module";
import { QueueModule } from "src/queue";
import { WebSocketModule } from "src/websocket";

import { AiModule } from "./ai/ai.module";
import { AnnouncementsModule } from "./announcements/announcements.module";
import { ArticlesModule } from "./articles/articles.module";
import { AuthModule } from "./auth/auth.module";
import { GoogleStrategy } from "./auth/strategy/google.strategy";
import { MicrosoftStrategy } from "./auth/strategy/microsoft.strategy";
import { SlackStrategy } from "./auth/strategy/slack.strategy";
import { BunnyStreamModule } from "./bunny/bunnyStream.module";
import { CacheModule } from "./cache/cache.module";
import { CategoryModule } from "./category/category.module";
import { CertificatesModule } from "./certificates/certificates.module";
import callbackUrlConfig from "./common/configuration/callbackUrl";
import database from "./common/configuration/database";
import emailConfig from "./common/configuration/email";
import jwtConfig from "./common/configuration/jwt";
import { getOptionalConfigs } from "./common/configuration/optional-config-loader";
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
import { IngestionModule } from "./ingestion/ingestion.module";
import { LessonModule } from "./lesson/lesson.module";
import { LocalizationModule } from "./localization/localization.module";
import { NewsModule } from "./news/news.module";
import { QuestionsModule } from "./questions/question.module";
import { ReportModule } from "./report/report.module";
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
        s3Config,
        stripeConfig,
        redisConfig,
        callbackUrlConfig,
        ...getOptionalConfigs(),
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
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB for videos
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
    BunnyStreamModule,
    StripeModule,
    EventsModule,
    StatisticsModule,
    ReportModule,
    ScormModule,
    CacheModule,
    QueueModule,
    WebSocketModule,
    AiModule,
    SettingsModule,
    CertificatesModule,
    AnnouncementsModule,
    IngestionModule,
    LearningTimeModule,
    EnvModule,
    LocalizationModule,
    ActivityLogsModule,
    QAModule,
    NewsModule,
    ArticlesModule,
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
    GoogleStrategy,
    MicrosoftStrategy,
    ...(process.env.SLACK_OAUTH_ENABLED === "true" ? [SlackStrategy] : []),
  ],
})
export class AppModule {}
