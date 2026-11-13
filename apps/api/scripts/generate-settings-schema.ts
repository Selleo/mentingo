import "reflect-metadata";

import { readFile, writeFile } from "node:fs/promises";

import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { patchNestJsSwagger } from "nestjs-typebox";

import type { InjectionToken } from "@nestjs/common";

// Regenerate settings controller metadata without database/Redis/application bootstrap.
async function generateSettingsSchema() {
  patchNestJsSwagger();
  const { SettingsController } = await import("../src/settings/settings.controller");
  const tokens: InjectionToken[] =
    Reflect.getMetadata("design:paramtypes", SettingsController) ?? [];
  const module = await Test.createTestingModule({
    controllers: [SettingsController],
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
    // Keep path insertion order and remove only routes formerly owned by this controller.
    const removedSchemaNames = new Set<string>();
    for (const [path, operations] of Object.entries(api.paths)) {
      const isSettingsPath = Object.values(operations).some((operation) =>
        operation?.operationId?.startsWith("SettingsController_"),
      );
      if (isSettingsPath && !(path in generated.paths)) {
        for (const match of JSON.stringify(operations).matchAll(
          /"#\/components\/schemas\/([^"]+)"/g,
        )) {
          removedSchemaNames.add(match[1]);
        }
        delete api.paths[path];
      }
    }
    Object.assign(api.paths, generated.paths);
    api.components = {
      ...api.components,
      schemas: { ...api.components?.schemas, ...generated.components?.schemas },
    };
    for (const name of removedSchemaNames) {
      const reference = `"#/components/schemas/${name}"`;
      // A removed route's response may still be shared by another route or component.
      const usedByPaths = JSON.stringify(api.paths).includes(reference);
      const usedBySchemas = Object.entries(api.components.schemas ?? {}).some(
        ([otherName, schema]) => otherName !== name && JSON.stringify(schema).includes(reference),
      );
      if (!usedByPaths && !usedBySchemas) delete api.components.schemas?.[name];
    }
    await writeFile(path, JSON.stringify(api, null, 2));
  } finally {
    await app.close();
  }
}

void generateSettingsSchema();
