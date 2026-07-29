import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";

import { Public } from "src/common/decorators/public.decorator";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import {
  EMAIL_TEMPLATE_IMAGE_CONTROLLER_PATH,
  EMAIL_TEMPLATE_IMAGE_PLACEHOLDER_CACHE_MAX_AGE_SECONDS,
  EMAIL_TEMPLATE_IMAGE_PLACEHOLDER_SVG,
  EMAIL_TEMPLATE_IMAGE_REDIRECT_CACHE_MAX_AGE_SECONDS,
} from "../email-notification-templates/email-template-image.constants";

import { PublicEmailTemplateImageService } from "./public-email-template-image.service";

@Controller(EMAIL_TEMPLATE_IMAGE_CONTROLLER_PATH)
export class PublicEmailTemplateImageController {
  constructor(
    private readonly service: PublicEmailTemplateImageService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  @Get(":reference")
  @Public()
  async serve(@Param("reference") reference: string, @Req() req: Request, @Res() res: Response) {
    const tenantId = await this.tenantResolver.resolveTenantId(req);

    const url = tenantId ? await this.service.resolveSignedUrl(reference, tenantId) : null;

    if (!url) {
      res.setHeader(
        "Cache-Control",
        `public, max-age=${EMAIL_TEMPLATE_IMAGE_PLACEHOLDER_CACHE_MAX_AGE_SECONDS}`,
      );
      res.type("image/svg+xml; charset=utf-8");
      res.send(EMAIL_TEMPLATE_IMAGE_PLACEHOLDER_SVG);
      return;
    }

    res.setHeader(
      "Cache-Control",
      `public, max-age=${EMAIL_TEMPLATE_IMAGE_REDIRECT_CACHE_MAX_AGE_SECONDS}`,
    );
    res.redirect(302, url);
  }
}
