import { Module } from "@nestjs/common";

import { CertificateRepository } from "./certificate.repository";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";

@Module({
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificateRepository],
  exports: [CertificatesService],
})
export class CertificatesModule {}
