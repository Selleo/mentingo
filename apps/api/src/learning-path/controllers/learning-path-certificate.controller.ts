import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { UUIDSchema, type UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { getRequestBaseUrl } from "src/common/helpers/getRequestBaseUrl";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  learningPathCertificateCreateShareLinkSchema,
  learningPathCertificateDownloadSchema,
  learningPathCertificateShareLinkSchema,
  learningPathCertificateShareSchema,
  type LearningPathCertificateCreateShareLinkBody,
  type LearningPathCertificateDownloadBody,
  type LearningPathCertificateShareLink,
  type LearningPathCertificateShare,
} from "../learning-path.schema";
import { LearningPathCertificateService } from "../services/learning-path-certificate.service";

@Controller("learning-path/certificates")
@UseGuards(PermissionsGuard)
export class LearningPathCertificateController {
  constructor(private readonly learningPathCertificateService: LearningPathCertificateService) {}

  @Get("certificate")
  @RequirePermission(PERMISSIONS.CERTIFICATE_READ)
  @Validate({
    request: [
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "learningPathId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: learningPathCertificateShareSchema,
  })
  async getCertificate(
    @Query("userId") userId: UUIDType,
    @Query("learningPathId") learningPathId: UUIDType,
    @Query("language") language: SupportedLanguages,
  ): Promise<LearningPathCertificateShare> {
    return this.learningPathCertificateService.getLearningPathCertificate(
      userId,
      learningPathId,
      language,
    );
  }

  @Post("download")
  @RequirePermission(PERMISSIONS.CERTIFICATE_RENDER)
  @Validate({
    request: [{ type: "body", schema: learningPathCertificateDownloadSchema }],
  })
  async downloadCertificate(
    @Body() body: LearningPathCertificateDownloadBody,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const requestBaseUrl = getRequestBaseUrl(req);
    const { pdfBuffer, filename } =
      await this.learningPathCertificateService.downloadLearningPathCertificate(
        currentUser.userId,
        body.certificateId,
        body.language,
        requestBaseUrl,
      );

    const asciiFilename =
      filename
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/["\\]/g, "")
        .trim() || "certificate.pdf";

    const contentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
      filename,
    )}`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Post("share-link")
  @RequirePermission(PERMISSIONS.CERTIFICATE_SHARE)
  @Validate({
    request: [{ type: "body", schema: learningPathCertificateCreateShareLinkSchema }],
    response: learningPathCertificateShareLinkSchema,
  })
  async createCertificateShareLink(
    @Body() body: LearningPathCertificateCreateShareLinkBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<LearningPathCertificateShareLink> {
    return this.learningPathCertificateService.createLearningPathCertificateShareLink(
      currentUser.userId,
      body.certificateId,
      body.language,
    );
  }

  @Public()
  @Get("share")
  async getCertificateSharePage(
    @Query("certificateId") certificateId: UUIDType,
    @Query("lang") language: SupportedLanguages,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.learningPathCertificateService.getPublicSharePage(
      certificateId,
      language,
    );

    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });

    res.send(html);
  }

  @Public()
  @Get("share-image")
  async getCertificateShareImage(
    @Query("certificateId") certificateId: UUIDType,
    @Query("lang") language: SupportedLanguages,
    @Res() res: Response,
  ): Promise<void> {
    const imageBuffer = await this.learningPathCertificateService.getPublicShareImage(
      certificateId,
      language,
    );

    res.set({
      "Content-Type": "image/png",
      "Content-Length": imageBuffer.length,
      "Cache-Control": "public, max-age=3600",
    });

    res.send(imageBuffer);
  }
}
