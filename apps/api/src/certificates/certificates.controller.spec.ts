import { Test, type TestingModule } from "@nestjs/testing";

import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";

describe("CertificatesController", () => {
  let controller: CertificatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificatesController],
      providers: [{ provide: CertificatesService, useValue: {} }],
    }).compile();

    controller = module.get<CertificatesController>(CertificatesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
