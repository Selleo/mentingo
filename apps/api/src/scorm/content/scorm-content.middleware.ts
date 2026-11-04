import { HttpStatus, Injectable } from "@nestjs/common";
import { SCORM_CONTENT_PATHS } from "@repo/shared";

import { ScormContentGrantsService } from "./scorm-content-grants.service";
import {
  getScormContentOrigin,
  isScormContentHost,
  isScormLocalEnvironment,
} from "./scorm-content.config";
import { SCORM_CONTENT_READ_METHODS } from "./scorm-content.constants";

import type { ScormContentGrantRequest } from "./scorm-content.types";
import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";

@Injectable()
export class ScormContentMiddleware implements NestMiddleware {
  constructor(private readonly scormContentGrantsService: ScormContentGrantsService) {}

  async use(request: ScormContentGrantRequest, response: Response, next: NextFunction) {
    if (!process.env.SCORM_CONTENT_ORIGIN && !isScormLocalEnvironment()) {
      return next();
    }
    const isDelivery = request.originalUrl.startsWith(SCORM_CONTENT_PATHS.PREFIX);
    const isContentHost = isScormContentHost(request);
    const isReadRequest = Object.values(SCORM_CONTENT_READ_METHODS).some(
      (method) => method === request.method,
    );
    if (isContentHost && (!isDelivery || !isReadRequest)) {
      return response.sendStatus(HttpStatus.NOT_FOUND);
    }
    if (!isDelivery && request.headers.origin === getScormContentOrigin()) {
      return response.sendStatus(HttpStatus.FORBIDDEN);
    }
    if (isContentHost) await this.attachActiveGrant(request);
    return next();
  }

  /**
   * Resolves the grant before global guards run, so rate limiting tracks the grant owner instead
   * of a shared IP. Invalid grants are left to ScormContentGuard to reject.
   */
  private async attachActiveGrant(request: ScormContentGrantRequest) {
    const [token] = request.originalUrl.slice(SCORM_CONTENT_PATHS.PREFIX.length).split(/[/?#]/);
    request.scormGrant = await this.scormContentGrantsService
      .findActiveGrant(token)
      .catch(() => undefined);
  }
}
