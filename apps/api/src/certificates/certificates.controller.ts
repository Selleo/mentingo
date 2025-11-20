import { Controller, Get, Query, UseGuards, Post, Body, Res } from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { PaginatedResponse, paginatedResponse, UUIDSchema, UUIDType } from "src/common";
import { RolesGuard } from "src/common/guards/roles.guard";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { allCertificatesSchema, downloadCertificateSchema } from "./certificates.schema";
import { CertificatesService } from "./certificates.service";

import type { AllCertificatesResponse } from "./certificates.types";

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
    response: allCertificatesSchema,
  })
  async getCertificate(
    @Query("userId") userId: UUIDType,
    @Query("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
  ): Promise<AllCertificatesResponse> {
    const certificate = await this.certificatesService.getCertificate(userId, courseId, language);
    return [certificate];
  }

  @Post("download")
  @Validate({
    request: [{ type: "body", schema: downloadCertificateSchema }],
  })
  async downloadCertificate(
    @Body() body: { html: string; filename?: string },
    @Res() res: Response,
  ): Promise<Buffer> {
    const { html, filename = "certificate.pdf" } = body;

    const pdfBuffer = await this.certificatesService.downloadCertificate(html);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);

    return pdfBuffer;
  }
}
