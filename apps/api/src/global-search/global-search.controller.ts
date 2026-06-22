import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { BaseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { GlobalSearchService } from "./global-search.service";
import {
  globalSearchBaseResponseSchema,
  globalSearchQuerySchema,
  type GlobalSearchResponse,
} from "./schemas/global-search.schema";

@Controller("global-search")
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get()
  @Validate({
    request: [
      {
        type: "query",
        name: "searchQuery",
        schema: globalSearchQuerySchema.properties.searchQuery,
      },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: globalSearchBaseResponseSchema,
  })
  @RequirePermission(
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_READ_ASSIGNED,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
    PERMISSIONS.LEARNING_PATH_READ,
    PERMISSIONS.NEWS_READ_PUBLIC,
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.NEWS_MANAGE_OWN,
    PERMISSIONS.ARTICLE_READ_PUBLIC,
    PERMISSIONS.ARTICLE_MANAGE,
    PERMISSIONS.ARTICLE_MANAGE_OWN,
    PERMISSIONS.QA_READ_PUBLIC,
    PERMISSIONS.QA_MANAGE,
    PERMISSIONS.QA_MANAGE_OWN,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.GROUP_READ,
    PERMISSIONS.GROUP_MANAGE,
  )
  async search(
    @Query("searchQuery") searchQuery: string,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSearchResponse>> {
    return new BaseResponse(
      await this.globalSearchService.search(
        searchQuery,
        language ?? SUPPORTED_LANGUAGES.EN,
        currentUser,
      ),
    );
  }
}
