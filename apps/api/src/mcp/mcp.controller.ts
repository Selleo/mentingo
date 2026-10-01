import { All, Controller, Req, Res, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Response } from "express";

import { Public } from "src/common/decorators/public.decorator";

import { McpAuthGuard } from "./mcp-auth.guard";
import { McpHttpService } from "./mcp-http.service";
import { McpRequest } from "./mcp.types";

@ApiExcludeController()
@Public()
@Controller("mcp")
export class McpController {
  constructor(private readonly http: McpHttpService) {}

  @All()
  @UseGuards(McpAuthGuard)
  async handle(@Req() request: McpRequest, @Res() response: Response): Promise<void> {
    await this.http.handle(request, response, request.mcpActor!);
  }
}
