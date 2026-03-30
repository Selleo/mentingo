import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { DEFAULT_TUS_CHUNK_SIZE } from "@repo/shared";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import { patchNestJsSwagger, applyFormats } from "nestjs-typebox";

import { version } from "../version.json";

import { AppModule } from "./app.module";
import {
  SWAGGER_INTEGRATION_ROUTE,
  SWAGGER_MAIN_ROUTE,
  registerSwaggerDocsAccessControl,
} from "./common/utils/swagger-docs-access";
import { IntegrationModule } from "./integration/integration.module";
import { startInstrumentation } from "./langfuse/instrumentation";
import { REDIS_PUBLISHER_CLIENT, REDIS_SUBSCRIBER_CLIENT, type RedisClient } from "./redis";
import { DB_ADMIN } from "./storage/db/db.providers";
import { createCorsOriginOption } from "./utils/cors";
import { Environment, environmentValidation } from "./utils/environment-validation";
import { exportSchemaToFile } from "./utils/save-swagger-to-file";
import { setupValidation } from "./utils/setup-validation";
import { RedisIoAdapter } from "./websocket/websocket.adapter";

patchNestJsSwagger();
applyFormats();

async function bootstrap() {
  startInstrumentation();

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [nodeProfilingIntegration()],
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      environment: environmentValidation(String(process.env.NODE_ENV)),
    });

    Sentry.setTags({
      version,
    });
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  setupValidation();

  const dbBase = app.get(DB_ADMIN);

  app.use(
    cors({
      origin: createCorsOriginOption(dbBase),
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.setGlobalPrefix("api");

  const jwtService = app.get(JwtService);
  const jwtSecret = app.get(ConfigService).get<string>("jwt.secret");

  const isDevelopment =
    environmentValidation(process.env.NODE_ENV as string) === Environment.DEVELOPMENT;

  registerSwaggerDocsAccessControl({ app, jwtService, jwtSecret, isDevelopment });

  app.use(
    "/api/file/videos/tus",
    bodyParser.raw({
      type: "application/offset+octet-stream",
      limit: DEFAULT_TUS_CHUNK_SIZE,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Mentingo API")
    .setDescription("This is the API documentation for Mentingo")
    .setVersion(version)
    .build();

  if (isDevelopment) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(SWAGGER_MAIN_ROUTE, app, document);
    exportSchemaToFile(document);
  }

  const integrationDocument = SwaggerModule.createDocument(app, config, {
    include: [IntegrationModule],
  });
  SwaggerModule.setup(SWAGGER_INTEGRATION_ROUTE, app, integrationDocument);
  exportSchemaToFile(integrationDocument, "./src/swagger/integration-api-schema.json");

  const redisPublisher = app.get<RedisClient>(REDIS_PUBLISHER_CLIENT);
  const redisSubscriber = app.get<RedisClient>(REDIS_SUBSCRIBER_CLIENT);
  const redisIoAdapter = new RedisIoAdapter(app, redisPublisher, redisSubscriber);
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(3000);
}
bootstrap();
