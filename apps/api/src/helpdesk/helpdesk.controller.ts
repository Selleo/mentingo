import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";

import { BaseResponse } from "src/common";

import { HelpdeskService } from "./helpdesk.service";
import {
  helpdeskDomainsBaseResponseSchema,
  helpdeskSearchBaseResponseSchema,
  helpdeskSearchRequestSchema,
  helpdeskTutorialBaseResponseSchema,
  helpdeskTutorialKeySchema,
  helpdeskTutorialQuerySchema,
  HelpdeskSearchRequest,
} from "./schemas/helpdesk.schema";

import type {
  HelpdeskDomainsResponse,
  HelpdeskSearchResponse,
  HelpdeskTutorialQuery,
  HelpdeskTutorialResponse,
} from "./schemas/helpdesk.schema";

/** Public product guidance requires the normal authenticated Core session, not content permissions. */
@ApiTags("Helpdesk")
@Controller("helpdesk")
export class HelpdeskController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  @Post("search")
  @ApiOperation({ operationId: "searchHelpdesk" })
  @Validate({
    request: [{ type: "body", name: "HelpdeskSearchRequest", schema: helpdeskSearchRequestSchema }],
    response: { schema: helpdeskSearchBaseResponseSchema, name: "HelpdeskSearchResponse" },
  })
  async search(
    @Body() input: HelpdeskSearchRequest,
  ): Promise<BaseResponse<HelpdeskSearchResponse>> {
    return new BaseResponse(await this.helpdeskService.search(input));
  }

  @Get("tutorials/:key")
  @ApiOperation({ operationId: "getHelpdeskTutorial" })
  @Validate({
    request: [
      { type: "param", name: "key", schema: helpdeskTutorialKeySchema },
      { type: "query", name: "language", schema: helpdeskTutorialQuerySchema.properties.language },
    ],
    response: { schema: helpdeskTutorialBaseResponseSchema, name: "HelpdeskTutorialResponse" },
  })
  async getTutorial(
    @Param("key") key: string,
    @Query("language") language: HelpdeskTutorialQuery["language"],
  ): Promise<BaseResponse<HelpdeskTutorialResponse>> {
    return new BaseResponse(await this.helpdeskService.getTutorial(key, { language }));
  }

  @Get("domains")
  @ApiOperation({ operationId: "getHelpdeskDomains" })
  @Validate({
    response: { schema: helpdeskDomainsBaseResponseSchema, name: "HelpdeskDomainsResponse" },
  })
  async getDomains(): Promise<BaseResponse<HelpdeskDomainsResponse>> {
    return new BaseResponse(await this.helpdeskService.getDomains());
  }
}
