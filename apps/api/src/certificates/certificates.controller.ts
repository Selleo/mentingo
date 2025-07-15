import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { PaginatedResponse, paginatedResponse, UUIDSchema } from "src/common";
import { RolesGuard } from "src/common/guards/roles.guard";

import { allCertificatesSchema } from "./certificates.schema";
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
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number()) },
      { type: "query", name: "sort", schema: Type.Optional(Type.String()) },
    ],
    response: paginatedResponse(allCertificatesSchema),
  })
  async getAllCertificates(
    @Query("userId") userId: string,
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("sort") sort?: string,
  ): Promise<PaginatedResponse<AllCertificatesResponse>> {
    const data = await this.certificatesService.getAllCertificates({
      userId,
      page,
      perPage,
      sort: sort as "createdAt",
    });
    return new PaginatedResponse(data);
  }

  @Get("certificate")
  @Validate({
    request: [
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "courseId", schema: UUIDSchema },
    ],
    response: allCertificatesSchema,
  })
  async getCertificate(
    @Query("userId") userId: string,
    @Query("courseId") courseId: string,
  ): Promise<AllCertificatesResponse> {
    const certificate = await this.certificatesService.getCertificate(userId, courseId);
    return [certificate];
  }
}
