import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Request, Response } from "express";

import { Public } from "src/common/decorators/public.decorator";

import { McpOAuthService } from "./mcp-oauth.service";

@ApiExcludeController()
@Public()
@Controller("oauth")
export class McpOAuthController {
  constructor(private readonly oauth: McpOAuthService) {}

  @Post("register")
  async register(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.oauth.register(request, response);
  }

  @Get("authorize")
  async authorizationPage(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.oauth.authorizationPage(request, response);
  }

  @Post("authorize")
  async authorize(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.oauth.authorize(request, response);
  }

  @Post("token")
  async token(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.oauth.token(request, response);
  }

  @Post("revoke")
  async revoke(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.oauth.revoke(request, response);
  }
}
