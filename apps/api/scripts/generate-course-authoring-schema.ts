import "reflect-metadata";

import { readFile, writeFile } from "node:fs/promises";

import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { patchNestJsSwagger } from "nestjs-typebox";

import type { InjectionToken } from "@nestjs/common";

// Scan controller metadata only: no application bootstrap, database, Redis, or listening port.
async function generateCourseAuthoringSchema() {
  patchNestJsSwagger();
  const { CourseAuthoringController } = await import("../src/luma/course-authoring.controller");
  const { CourseAuthoringLinkPreviewController } = await import(
    "../src/luma/course-authoring-link-preview.controller"
  );
  const controllers = [CourseAuthoringController, CourseAuthoringLinkPreviewController];
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
      if (path.startsWith("/api/luma/")) delete api.paths[path];
    }
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

void generateCourseAuthoringSchema();
