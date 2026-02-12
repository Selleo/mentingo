import "dotenv/config";
import { NestFactory } from "@nestjs/core";
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
import { IntegrationModule } from "./integration/integration.module";
import { startInstrumentation } from "./langfuse/instrumentation";
import { DB_ADMIN } from "./storage/db/db.providers";
import { createCorsOriginOption } from "./utils/cors";
import { environmentValidation } from "./utils/environment-validation";
import { exportSchemaToFile } from "./utils/save-swagger-to-file";
import { setupValidation } from "./utils/setup-validation";
import { RedisIoAdapter } from "./websocket/websocket.adapter";

patchNestJsSwagger();
applyFormats();

async function bootstrap() {
  startInstrumentation();
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

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

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
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);
  exportSchemaToFile(document);

  const integrationDocument = SwaggerModule.createDocument(app, config, {
    include: [IntegrationModule],
  });
  SwaggerModule.setup("integration-docs", app, integrationDocument);
  exportSchemaToFile(integrationDocument, "./src/swagger/integration-api-schema.json");

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }

  await app.listen(3000);
}
bootstrap();
