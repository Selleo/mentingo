import { Test, type TestingModule } from "@nestjs/testing";

import { CertificatesService } from "./certificates.service";

describe("CertificatesService", () => {
  let service: CertificatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CertificatesService],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
