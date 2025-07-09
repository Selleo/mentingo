import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { RolesGuard } from "src/common/guards/roles.guard";

import { CertificatesService } from "./certificates.service";
import { CertificatesQuery } from "./certificates.types";

@Controller("certificates")
@UseGuards(RolesGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get("all")
  async getAllCertificates(@Query() query: CertificatesQuery) {
    return this.certificatesService.getAllCertificates(query);
  }
}
