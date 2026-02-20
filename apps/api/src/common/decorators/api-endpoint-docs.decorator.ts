import { applyDecorators } from "@nestjs/common";
import { ApiHeader, ApiOperation } from "@nestjs/swagger";

type SwaggerHeaderOptions = Parameters<typeof ApiHeader>[0];

type ApiEndpointDocsOptions = {
  summary: string;
  description: string;
  headers?: SwaggerHeaderOptions[];
};

export const API_HEADERS = {
  X_TENANT_ID: {
    name: "X-Tenant-Id",
    required: true,
    description:
      "Target tenant context for this request. Must be one of the tenant IDs returned by GET /integration/tenants.",
  } satisfies SwaggerHeaderOptions,
};

export const ApiEndpointDocs = ({
  summary,
  description,
  headers = [API_HEADERS.X_TENANT_ID],
}: ApiEndpointDocsOptions) =>
  applyDecorators(
    ApiOperation({ summary, description }),
    ...headers.map((header) => ApiHeader(header)),
  );
