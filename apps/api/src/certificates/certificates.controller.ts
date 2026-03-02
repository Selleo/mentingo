import { Controller, Get, Query, UseGuards, Post, Body, Res } from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { PaginatedResponse, paginatedResponse, UUIDSchema, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  allCertificatesSchema,
  certificateShareLinkResponseSchema,
  createCertificateShareLinkSchema,
  downloadCertificateSchema,
  singleCertificateSchema,
} from "./certificates.schema";
import { CertificatesService } from "./certificates.service";
import { CreateCertificateShareLinkBody } from "./certificates.types";

import type {
  AllCertificatesResponse,
  CertificateShareLinkResponse,
  SingleCertificateResponse,
} from "./certificates.types";

@Controller("certificates")
@UseGuards(RolesGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get("all")
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
  @Validate({
    request: [{ type: "body", schema: downloadCertificateSchema }],
  })
  async downloadCertificate(
    @Body() body: { html: string; filename?: string },
    @Res() res: Response,
  ): Promise<void> {
    const { html, filename = "certificate.pdf" } = body;

    const pdfBuffer = await this.certificatesService.downloadCertificate(html);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Post("share-link")
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
