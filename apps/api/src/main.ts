import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import cookieParser from "cookie-parser";
import { patchNestJsSwagger, applyFormats } from "nestjs-typebox";

import { version } from "../version.json";

import { AppModule } from "./app.module";
import { startInstrumentation } from "./langfuse/instrumentation";
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

  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("Guidebook API")
    .setDescription("Example usage of Swagger with Typebox")
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);
  exportSchemaToFile(document);

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }

  await app.listen(3000);
}
bootstrap();
