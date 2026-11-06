import { Injectable, NotFoundException } from "@nestjs/common";

import { ScormContentGrantsService } from "./scorm-content-grants.service";
import { isScormContentHost } from "./scorm-content.config";
import { SCORM_CONTENT_ERROR_KEYS, SCORM_CONTENT_RESPONSE_POLICY } from "./scorm-content.constants";

import type { ScormContentGrantRequest } from "./scorm-content.types";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";

/** Admits only isolated-origin requests that carry an active content grant, acting as its owner. */
@Injectable()
export class ScormContentGuard implements CanActivate {
  constructor(private readonly scormContentGrantsService: ScormContentGrantsService) {}

  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<ScormContentGrantRequest>();
    http
      .getResponse<Response>()
      .setHeader("Cache-Control", SCORM_CONTENT_RESPONSE_POLICY.CACHE_CONTROL);

    if (!isScormContentHost(request)) {
      throw new NotFoundException(SCORM_CONTENT_ERROR_KEYS.NOT_FOUND);
    }

    const grant =
      request.scormGrant ??
      (await this.scormContentGrantsService.findActiveGrant(request.params.token));
    request.scormGrant = grant;
    request.user = grant.actor;

    return true;
  }
}
