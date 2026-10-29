import "reflect-metadata";

import { readFile, writeFile } from "node:fs/promises";

import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { patchNestJsSwagger } from "nestjs-typebox";

import type { InjectionToken } from "@nestjs/common";

// Scan controller metadata only: no application bootstrap, database, Redis, or listening port.
async function generateAiConversationSchema() {
  patchNestJsSwagger();
  const { AdminAiThreadsController } = await import("../src/ai/admin-ai-threads.controller");
  const { SlackConversationsController } = await import(
    "../src/mcp/slack-conversations.controller"
  );
  const controllers = [AdminAiThreadsController, SlackConversationsController];
  const { McpAuthGuard } = await import("../src/mcp/mcp-auth.guard");
  const tokens: InjectionToken[] = controllers.flatMap(
    (controller) => Reflect.getMetadata("design:paramtypes", controller) ?? [],
  );
  const module = await Test.createTestingModule({
    controllers,
    providers: [...new Set(tokens)].map((provide) => ({ provide, useValue: {} })),
  })
    .overrideGuard(McpAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api");

  try {
    const apiPath = "src/swagger/api-schema.json";
    const api = JSON.parse(await readFile(apiPath, "utf8")) as OpenAPIObject;
    const generated = SwaggerModule.createDocument(app, {
      openapi: api.openapi,
      info: api.info,
      tags: api.tags ?? [],
      servers: api.servers ?? [],
    });

    Object.assign(api.paths, generated.paths);
    api.components = {
      ...api.components,
      schemas: { ...api.components?.schemas, ...generated.components?.schemas },
    };
    await writeFile(apiPath, JSON.stringify(api, null, 2));
  } finally {
    await app.close();
  }
}

void generateAiConversationSchema();
