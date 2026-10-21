import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiForbiddenResponse, ApiHeader, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { PaginatedResponse, paginatedResponse } from "src/common";
import { API_HEADERS, ApiEndpointDocs } from "src/common/decorators/api-endpoint-docs.decorator";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { DEFAULT_PAGE_SIZE, parsePagination } from "src/common/pagination";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { IntegrationKeyTenant } from "./decorators/integration-key-tenant.decorator";
import { IntegrationApiKeyGuard } from "./guards/integration-api-key.guard";
import { INTEGRATION_COURSES_MAX_PAGE_SIZE } from "./integration.constants";
import { IntegrationKeyTenantContext } from "./integration.types";
import {
  integrationCoursesSchema,
  type IntegrationCoursesResponse,
} from "./schemas/integration-course.schema";
import { IntegrationCourseCatalogService } from "./services/integration-course-catalog.service";

import type { SupportedLanguages } from "@repo/shared";

@ApiHeader({
  name: "X-API-Key",
  required: true,
  description: "Integration API key used to authenticate every integration request.",
})
@ApiTags("Integration")
@ApiUnauthorizedResponse({
  description: "Missing or invalid integration API key.",
})
@ApiForbiddenResponse({
  description: "Authenticated integration key owner is not authorized.",
})
@Public()
@Controller("integration")
@UseGuards(IntegrationApiKeyGuard, PermissionsGuard)
export class IntegrationCoursesController {
  constructor(private readonly integrationCourseCatalogService: IntegrationCourseCatalogService) {}

  @Get("courses")
  @RequirePermission(PERMISSIONS.INTEGRATION_API_USE)
  @ApiEndpointDocs({
    summary: "List courses for an external catalog",
    description:
      "Returns the non-archived courses of the tenant selected by X-Tenant-Id, with localized title and description, languages, a signed thumbnail URL and chapter and lesson counts.\n\nRequires a managing tenant key whose owner has the course export permission. Titles and descriptions use the given language and fall back to each course's base language.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
  @Validate({
    request: [
      { type: "query", name: "keyword", schema: Type.String({ maxLength: 200 }) },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Number({ minimum: 1, maximum: INTEGRATION_COURSES_MAX_PAGE_SIZE }),
      },
    ],
    response: paginatedResponse(integrationCoursesSchema),
  })
  async getTenantCourses(
    @Query("keyword") keyword: string | undefined,
    @Query("language") language: SupportedLanguages | undefined,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser() actor: CurrentUserType,
    @IntegrationKeyTenant() keyTenant: IntegrationKeyTenantContext,
  ): Promise<PaginatedResponse<IntegrationCoursesResponse>> {
    return new PaginatedResponse(
      await this.integrationCourseCatalogService.listTenantCourses(
        {
          keyword: keyword?.trim() || undefined,
          language,
          ...parsePagination(page, perPage, { perPage: DEFAULT_PAGE_SIZE }),
        },
        actor,
        keyTenant,
      ),
    );
  }
}
