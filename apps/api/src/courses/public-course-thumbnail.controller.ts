import { Controller, ForbiddenException, Get, Param, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { UUIDSchema, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { PublicCourseThumbnailService } from "./public-course-thumbnail.service";

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#6b7280">Course thumbnail</text></svg>`;

const REDIRECT_CACHE_MAX_AGE_SECONDS = 1800;

@Controller("public/course-thumbnail")
export class PublicCourseThumbnailController {
  constructor(
    private readonly publicCourseThumbnailService: PublicCourseThumbnailService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  @Get(":courseId")
  @Public()
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
  })
  async getThumbnail(
    @Param("courseId") courseId: UUIDType,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = await this.tenantResolver.resolveTenantId(req);
    if (!tenantId) throw new ForbiddenException("tenant.error.unresolved");

    const url = await this.publicCourseThumbnailService.resolveSignedUrl(courseId, tenantId);

    if (!url) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(PLACEHOLDER_SVG);
      return;
    }

    res.setHeader("Cache-Control", `public, max-age=${REDIRECT_CACHE_MAX_AGE_SECONDS}`);
    res.redirect(302, url);
  }
}
