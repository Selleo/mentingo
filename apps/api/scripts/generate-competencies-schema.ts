import "reflect-metadata";

import { readFile, writeFile } from "node:fs/promises";

import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { patchNestJsSwagger } from "nestjs-typebox";

import type { InjectionToken } from "@nestjs/common";

// Follow the existing metadata-only generators without starting databases or workers.
async function generateCompetenciesSchema() {
  patchNestJsSwagger();
  const { CompetenciesController } = await import("../src/competencies/competencies.controller");
  const tokens: InjectionToken[] =
    Reflect.getMetadata("design:paramtypes", CompetenciesController) ?? [];
  const module = await Test.createTestingModule({
    controllers: [CompetenciesController],
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
    if (
      !generated.paths["/api/competencies/workspace"] ||
      !generated.paths["/api/competencies/commands"]
    )
      throw new Error("Competencies contracts were not generated");
    for (const path of Object.keys(api.paths))
      if (path.startsWith("/api/competencies/")) delete api.paths[path];
    Object.assign(api.paths, generated.paths);
    for (const name of [
      "PreviewCompetenciesImportBody",
      "PreviewCompetenciesImportResponse",
      "ApplyCompetenciesImportBody",
      "ApplyCompetenciesImportResponse",
    ])
      delete api.components?.schemas?.[name];
    api.components = {
      ...api.components,
      schemas: { ...api.components?.schemas, ...generated.components?.schemas },
    };
    await writeFile(apiPath, JSON.stringify(api, null, 2));
  } finally {
    await app.close();
  }
}
void generateCompetenciesSchema();
