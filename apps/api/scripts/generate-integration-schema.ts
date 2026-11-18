import "reflect-metadata";

import { readFile, writeFile } from "node:fs/promises";

import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { patchNestJsSwagger } from "nestjs-typebox";

import type { InjectionToken } from "@nestjs/common";

// Scan controller metadata only: no application bootstrap, database, Redis, or listening port.
async function generateIntegrationSchema() {
  patchNestJsSwagger();
  const { IntegrationController } = await import("../src/integration/integration.controller");
  const { IntegrationAdminController } = await import(
    "../src/integration/integration-admin.controller"
  );
  const reportOnly = process.argv.includes("--report");
  const { ReportController } = await import("../src/report/report.controller");
  const controllers = reportOnly
    ? [ReportController]
    : [IntegrationController, IntegrationAdminController];
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
    const integrationPath = "src/swagger/integration-api-schema.json";
    const apiPath = "src/swagger/api-schema.json";
    const previousIntegration = JSON.parse(
      await readFile(integrationPath, "utf8"),
    ) as OpenAPIObject;
    const api = JSON.parse(await readFile(apiPath, "utf8")) as OpenAPIObject;
    const generated = SwaggerModule.createDocument(app, {
      openapi: previousIntegration.openapi,
      info: previousIntegration.info,
      tags: previousIntegration.tags ?? [],
      servers: previousIntegration.servers ?? [],
    });

    // Replace only the integration surface; preserve unrelated controllers' generated contracts.
    for (const path of Object.keys(reportOnly ? api.paths : previousIntegration.paths)) {
      if (reportOnly && !path.startsWith("/api/report/")) continue;
      if (!(path in generated.paths)) delete api.paths[path];
    }
    Object.assign(api.paths, generated.paths);
    api.components = {
      ...api.components,
      schemas: { ...api.components?.schemas, ...generated.components?.schemas },
    };
    if (!reportOnly) await writeFile(integrationPath, JSON.stringify(generated, null, 2));
    await writeFile(apiPath, JSON.stringify(api, null, 2));
  } finally {
    await app.close();
  }
}

void generateIntegrationSchema();
