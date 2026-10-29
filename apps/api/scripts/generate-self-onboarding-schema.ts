import "reflect-metadata";

import { readFile, writeFile } from "node:fs/promises";

import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { patchNestJsSwagger } from "nestjs-typebox";

import type { InjectionToken } from "@nestjs/common";

/** Export Helpdesk and its Assistant source contract without databases or providers. */
async function generateHelpdeskSchema() {
  patchNestJsSwagger();
  const { HelpdeskController } = await import("../src/self-onboarding/self-onboarding.controller");
  const { AssistantController } = await import("../src/assistant/assistant.controller");
  const controllers = [HelpdeskController, AssistantController];
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
    const path = "src/swagger/api-schema.json";
    const api = JSON.parse(await readFile(path, "utf8")) as OpenAPIObject;
    const generated = SwaggerModule.createDocument(app, {
      openapi: api.openapi,
      info: api.info,
      tags: api.tags ?? [],
      servers: api.servers ?? [],
    });
    const oldHelpdeskComponents = new Set<string>();
    const collectReferences = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      for (const [key, nested] of Object.entries(value)) {
        if (
          key === "$ref" &&
          typeof nested === "string" &&
          nested.startsWith("#/components/schemas/")
        ) {
          oldHelpdeskComponents.add(nested.slice("#/components/schemas/".length));
        } else collectReferences(nested);
      }
    };
    for (const [route, value] of Object.entries(api.paths)) {
      if (route.startsWith("/api/helpdesk/")) collectReferences(value);
    }
    for (const route of Object.keys(api.paths)) {
      if (
        (route.startsWith("/api/helpdesk/") || route.startsWith("/api/assistant/")) &&
        !generated.paths[route]
      ) {
        delete api.paths[route];
      }
    }
    Object.assign(api.paths, generated.paths);
    api.components = {
      ...api.components,
      schemas: { ...api.components?.schemas, ...generated.components?.schemas },
    };
    // Remove only obsolete Helpdesk definitions which no current route/schema references.
    for (const name of oldHelpdeskComponents) {
      if (generated.components?.schemas?.[name]) continue;
      const reference = `#/components/schemas/${name}`;
      const otherSchemas = { ...api.components.schemas };
      delete otherSchemas[name];
      if (
        !JSON.stringify(api.paths).includes(reference) &&
        !JSON.stringify(otherSchemas).includes(reference)
      ) {
        delete api.components.schemas?.[name];
      }
    }
    await writeFile(path, JSON.stringify(api, null, 2));
  } finally {
    await app.close();
  }
}

void generateHelpdeskSchema();
