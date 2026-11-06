import { Injectable, NotFoundException } from "@nestjs/common";

import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { ScormService } from "../scorm.service";

import { ScormContentGrantsService } from "./scorm-content-grants.service";
import { assertScormContentOriginConfigured } from "./scorm-content.config";
import { SCORM_CONTENT_ERROR_KEYS } from "./scorm-content.constants";

import type { RenewScormContentResponse } from "../schemas/scormContent.schema";
import type { ScormLaunchResponse } from "../schemas/scormRuntime.schema";
import type { ScormRuntimeLaunchParams } from "../scorm.types";
import type { Request } from "express";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class ScormContentAccessService {
  constructor(
    private readonly scormService: ScormService,
    private readonly scormContentGrantsService: ScormContentGrantsService,
    private readonly tenantResolverService: TenantResolverService,
  ) {}

  /** Launches the runtime and returns a launch URL on the isolated content origin. */
  async launchIsolatedRuntime(
    params: ScormRuntimeLaunchParams,
    request: Request,
  ): Promise<ScormLaunchResponse> {
    assertScormContentOriginConfigured();

    const parentOrigin = await this.tenantResolverService.resolveTenantHost(request);
    if (!parentOrigin) throw new NotFoundException(SCORM_CONTENT_ERROR_KEYS.NOT_FOUND);

    const { contentLaunchPath, ...launch } = await this.scormService.launchRuntime(params);
    const { extractedFilesReference } = await this.scormService.getContentGrantDetails(
      launch.packageId,
      params.currentUser,
    );
    const launchUrl = await this.scormContentGrantsService.createGrantedContentUrl({
      actor: params.currentUser,
      packageId: launch.packageId,
      extractedFilesReference,
      launchPath: contentLaunchPath,
      parentOrigin,
    });

    return { ...launch, launchUrl };
  }

  async renewContentAccess(
    token: string,
    currentUser: CurrentUserType,
  ): Promise<RenewScormContentResponse> {
    const grant = await this.scormContentGrantsService.findActiveGrant(token);
    await this.scormService.assertContentGrantAccess({ ...grant, actor: currentUser });
    await this.scormContentGrantsService.extendGrantForActor(token, currentUser);

    return { renewed: true };
  }
}
