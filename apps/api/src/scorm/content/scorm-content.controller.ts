import { readFile } from "node:fs/promises";
import path from "node:path";

import { Controller, Get, Headers, Param, Req, Res, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SCORM_CONTENT_PATHS } from "@repo/shared";
import { Response } from "express";

import { Public } from "src/common/decorators/public.decorator";
import { streamFileToResponse } from "src/file/utils/streamFileToResponse";

import { ScormService } from "../scorm.service";

import { renderScormBootstrap } from "./player/scorm-player-bootstrap";
import { renderScormPlayer } from "./player/scorm-player.template";
import { SCORM_CONTENT_CONFIG } from "./scorm-content.constants";
import { ScormContentGuard } from "./scorm-content.guard";
import { setScormContentHeaders } from "./scorm-content.headers";
import { ScormContentRequest } from "./scorm-content.types";

@ApiExcludeController()
@Public()
@UseGuards(ScormContentGuard)
@Controller(SCORM_CONTENT_PATHS.CONTROLLER)
export class ScormContentController {
  constructor(private readonly scormService: ScormService) {}

  @Get(SCORM_CONTENT_PATHS.PLAYER)
  async servePlayerPage(@Req() request: ScormContentRequest, @Res() response: Response) {
    await this.authorizeGrantedContent(request, response);
    response.type("html").send(renderScormPlayer(request.params.token));
  }

  @Get(SCORM_CONTENT_PATHS.RUNTIME_SCRIPT)
  async serveRuntimeScript(@Req() request: ScormContentRequest, @Res() response: Response) {
    await this.authorizeGrantedContent(request, response);
    const bundle = path.join(
      path.dirname(require.resolve("scorm-again")),
      SCORM_CONTENT_CONFIG.RUNTIME_BUNDLE,
    );
    response.type("application/javascript").send(await readFile(bundle, "utf8"));
  }

  @Get(SCORM_CONTENT_PATHS.BOOTSTRAP_SCRIPT)
  async serveBootstrapScript(@Req() request: ScormContentRequest, @Res() response: Response) {
    await this.authorizeGrantedContent(request, response);
    const { parentOrigin, launchPath } = request.scormGrant;
    response.type("application/javascript").send(
      renderScormBootstrap({
        parentOrigin,
        channel: request.params.token,
        assetUrl: `${SCORM_CONTENT_PATHS.PREFIX}${request.params.token}/${SCORM_CONTENT_PATHS.ASSETS}/${launchPath}`,
      }),
    );
  }

  @Get(`${SCORM_CONTENT_PATHS.ASSETS}/*`)
  async serveContentAsset(
    @Req() request: ScormContentRequest,
    @Res() response: Response,
    @Param("0") relativePath: string,
    @Headers("range") range?: string,
  ) {
    await this.authorizeGrantedContent(request, response);
    const grant = request.scormGrant;
    const file = await this.scormService.getContentFile({
      packageId: grant.packageId,
      relativePath,
      currentUser: grant.actor,
      range,
    });
    streamFileToResponse(response, { ...file, contentDisposition: "inline" });
  }

  private async authorizeGrantedContent(request: ScormContentRequest, response: Response) {
    const grant = request.scormGrant;
    await this.scormService.assertContentGrantAccess(grant);
    setScormContentHeaders(response, grant.parentOrigin);
  }
}
