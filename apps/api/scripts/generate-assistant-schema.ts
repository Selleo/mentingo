import "reflect-metadata";

import { readFile, writeFile } from "node:fs/promises";

import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { patchNestJsSwagger } from "nestjs-typebox";

import { baseResponse } from "../src/common";
import { currentUserResponseSchema } from "../src/user/schemas/user.schema";

import type { InjectionToken } from "@nestjs/common";

/** Generate controller metadata without booting providers or opening infrastructure connections. */
async function generateAssistantSchema() {
  patchNestJsSwagger();
  const { AssistantController } = await import("../src/assistant/assistant.controller");
  const { AdminAiThreadsController } = await import("../src/ai/admin-ai-threads.controller");
  const controllers = [AssistantController, AdminAiThreadsController];
  const tokens: InjectionToken[] = controllers.flatMap(
    (controller) => Reflect.getMetadata("design:paramtypes", controller) ?? [],
  );
  const module = await Test.createTestingModule({
    controllers,
    providers: [...new Set(tokens)].map((provide) => ({ provide, useValue: {} })),
  }).compile();
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
    for (const path of Object.keys(api.paths)) {
      if (
        (path.startsWith("/api/assistant/") || path.startsWith("/api/admin/ai-threads")) &&
        !(path in generated.paths)
      )
        delete api.paths[path];
    }
    Object.assign(api.paths, generated.paths);
    // The new shared permission also changes the authenticated current-user contract.
    const currentUser = api.paths["/api/auth/current-user"]?.get?.responses?.["200"];
    if (currentUser && "content" in currentUser && currentUser.content?.["application/json"]) {
      currentUser.content["application/json"].schema = {
        $ref: "#/components/schemas/CurrentUserResponse",
      };
    }

    api.components = {
      ...api.components,
      schemas: {
        ...api.components?.schemas,
        ...generated.components?.schemas,
        CurrentUserResponse: JSON.parse(JSON.stringify(baseResponse(currentUserResponseSchema))),
      },
    };
    await writeFile(apiPath, JSON.stringify(api, null, 2));
  } finally {
    await app.close();
  }
}

void generateAssistantSchema();
