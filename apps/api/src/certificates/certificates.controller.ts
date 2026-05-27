import { Controller, Get, Query, UseGuards, Post, Body, Res, Req, Param } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { PaginatedResponse, paginatedResponse, UUIDSchema, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { getRequestBaseUrl } from "src/common/helpers/getRequestBaseUrl";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  allCertificatesSchema,
  certificateResetOptionsResponseSchema,
  certificateResetUsersSchema,
  certificateValidityImpactResponseSchema,
  certificateValidityImpactSchema,
  certificateShareLinkResponseSchema,
  createCertificateShareLinkSchema,
  downloadCertificateSchema,
  resetCourseCertificatesResponseSchema,
  resetCourseCertificatesSchema,
  singleCertificateSchema,
} from "./certificates.schema";
import { CertificatesService } from "./certificates.service";
import {
  CertificateValidityImpactBody,
  CreateCertificateShareLinkBody,
  DownloadCertificateBody,
  ResetCourseCertificatesBody,
} from "./certificates.types";

import type {
  AllCertificatesResponse,
  CertificateResetOptionsResponse,
  CertificateResetUsersResponse,
  CertificateValidityImpactResponse,
  CertificateShareLinkResponse,
  ResetCourseCertificatesResponse,
  SingleCertificateResponse,
} from "./certificates.types";

@Controller("certificates")
@UseGuards(PermissionsGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get("all")
  @RequirePermission(PERMISSIONS.CERTIFICATE_READ)
  @Validate({
    request: [
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number()) },
      { type: "query", name: "sort", schema: Type.Optional(Type.String()) },
    ],
    response: paginatedResponse(allCertificatesSchema),
  })
  async getAllCertificates(
    @Query("userId") userId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("sort") sort?: string,
  ): Promise<PaginatedResponse<AllCertificatesResponse>> {
    const data = await this.certificatesService.getAllCertificates({
      userId,
      page,
      perPage,
      language,
      sort: sort as "createdAt",
    });
    return new PaginatedResponse(data);
  }

  @Get("certificate")
  @RequirePermission(PERMISSIONS.CERTIFICATE_READ)
  @Validate({
    request: [
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: singleCertificateSchema,
  })
  async getCertificate(
    @Query("userId") userId: UUIDType,
    @Query("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
  ): Promise<SingleCertificateResponse> {
    const certificate = await this.certificatesService.getCertificate(userId, courseId, language);
    return certificate;
  }

  @Post("download")
  @RequirePermission(PERMISSIONS.CERTIFICATE_RENDER)
  @Validate({
    request: [{ type: "body", schema: downloadCertificateSchema }],
  })
  async downloadCertificate(
    @Body() body: DownloadCertificateBody,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { certificateId, language } = body;
    const requestBaseUrl = getRequestBaseUrl(req);

    const { pdfBuffer, filename } = await this.certificatesService.downloadCertificate(
      currentUser.userId,
      certificateId,
      language,
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
    request: [{ type: "body", schema: createCertificateShareLinkSchema }],
    response: certificateShareLinkResponseSchema,
  })
  async createCertificateShareLink(
    @Body() body: CreateCertificateShareLinkBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CertificateShareLinkResponse> {
    return this.certificatesService.createCertificateShareLink(
      currentUser.userId,
      body.certificateId,
      body.language,
    );
  }

  @Post("course/:courseId/validity-impact")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: certificateValidityImpactSchema },
    ],
    response: certificateValidityImpactResponseSchema,
  })
  async getCertificateValidityImpact(
    @Param("courseId") courseId: UUIDType,
    @Body() body: CertificateValidityImpactBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CertificateValidityImpactResponse> {
    return this.certificatesService.getCertificateValidityImpact(
      courseId,
      body.certificateValidity,
      currentUser,
    );
  }

  @Get("course/:courseId/reset-options")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(supportedLanguagesSchema) },
    ],
    response: certificateResetOptionsResponseSchema,
  })
  async getCertificateResetOptions(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CertificateResetOptionsResponse> {
    return this.certificatesService.getCertificateResetOptions(courseId, language, currentUser);
  }

  @Get("course/:courseId/reset-users")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "search", schema: Type.Optional(Type.String()) },
      { type: "query", name: "language", schema: Type.Optional(supportedLanguagesSchema) },
    ],
    response: paginatedResponse(certificateResetUsersSchema),
  })
  async getCertificateResetUsers(
    @Param("courseId") courseId: UUIDType,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<CertificateResetUsersResponse>> {
    const data = await this.certificatesService.getCertificateResetUsers(
      courseId,
      { language, page, perPage, search },
      currentUser,
    );

    return new PaginatedResponse(data);
  }

  @Post("course/:courseId/reset")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: resetCourseCertificatesSchema },
    ],
    response: resetCourseCertificatesResponseSchema,
  })
  async resetCourseCertificates(
    @Param("courseId") courseId: UUIDType,
    @Body() body: ResetCourseCertificatesBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ResetCourseCertificatesResponse> {
    return this.certificatesService.resetCourseCertificates(courseId, body, currentUser);
  }

  @Public()
  @Get("share")
  async getCertificateSharePage(
    @Query("certificateId") certificateId: UUIDType,
    @Query("lang") language: SupportedLanguages,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.certificatesService.getPublicSharePage(certificateId, language);

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
    const imageBuffer = await this.certificatesService.getPublicShareImage(certificateId, language);

    res.set({
      "Content-Type": "image/png",
      "Content-Length": imageBuffer.length,
      "Cache-Control": "public, max-age=3600",
    });

    res.send(imageBuffer);
  }
}
