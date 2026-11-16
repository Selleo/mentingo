import { Injectable, NotFoundException } from "@nestjs/common";

import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { ScormService } from "../scorm.service";

import { ScormContentGrantsService } from "./scorm-content-grants.service";
import { assertScormContentOriginConfigured } from "./scorm-content.config";
import { SCORM_CONTENT_ERROR_KEYS } from "./scorm-content.constants";

import type { ScormContentGrantInput } from "./scorm-content.types";
import type { RenewScormContentResponse } from "../schemas/scormContent.schema";
import type {
  ScormLaunchResponse,
  ScormPreviewLaunchResponse,
} from "../schemas/scormRuntime.schema";
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
    const parentOrigin = await this.resolveParentOrigin(request);
    const { contentLaunchPath, ...launch } = await this.scormService.launchRuntime(params);
    const launchUrl = await this.createLaunchUrl({
      actor: params.currentUser,
      packageId: launch.packageId,
      launchPath: contentLaunchPath,
      parentOrigin,
    });

    return { ...launch, launchUrl };
  }

  async launchIsolatedPreviewRuntime(
    params: ScormRuntimeLaunchParams,
    request: Request,
  ): Promise<ScormPreviewLaunchResponse> {
    const parentOrigin = await this.resolveParentOrigin(request);

    const { contentLaunchPath, ...launch } = await this.scormService.launchPreviewRuntime(params);

    const launchUrl = await this.createLaunchUrl({
      actor: params.currentUser,
      packageId: launch.packageId,
      previewLessonId: launch.lessonId,
      launchPath: contentLaunchPath,
      parentOrigin,
    });

    return { ...launch, launchUrl };
  }

  private async resolveParentOrigin(request: Request) {
    assertScormContentOriginConfigured();

    const parentOrigin = await this.tenantResolverService.resolveTenantHost(request);
    if (!parentOrigin) throw new NotFoundException(SCORM_CONTENT_ERROR_KEYS.NOT_FOUND);

    return parentOrigin;
  }

  private async createLaunchUrl(grant: Omit<ScormContentGrantInput, "extractedFilesReference">) {
    const { extractedFilesReference } = await this.scormService.getContentGrantDetails(grant);

    return this.scormContentGrantsService.createGrantedContentUrl({
      ...grant,
      extractedFilesReference,
    });
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
