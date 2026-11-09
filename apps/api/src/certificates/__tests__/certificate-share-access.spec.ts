import { NotFoundException } from "@nestjs/common";

import { LearningPathCertificateService } from "src/learning-path/services/learning-path-certificate.service";

import { CertificatesService } from "../certificates.service";

const token = "adff6c7d-cc5e-4328-8c9e-893411e5bcd1";

describe.each([
  [CertificatesService, "certificateRepository", "findCertificateIdByShareToken"],
  [
    LearningPathCertificateService,
    "learningPathRepository",
    "findLearningPathCertificateIdByShareToken",
  ],
])("%p public share access", (Service, repositoryName, lookupName) => {
  const makeService = () => {
    const service = Object.create(Service.prototype);
    const lookup = jest.fn().mockResolvedValue("certificate-id");
    service[repositoryName] = { [lookupName]: lookup };
    service.getPublicSharePage = jest.fn().mockResolvedValue("share page");
    service.getPublicShareImage = jest.fn().mockResolvedValue(Buffer.from("share image"));
    return { service, lookup };
  };

  it("rejects tokens that were never issued without rendering anything", async () => {
    const { service, lookup } = makeService();
    lookup.mockResolvedValue(undefined);

    await expect(service.getPublicSharePageByToken(token, "en")).rejects.toThrow(NotFoundException);
    await expect(service.getPublicShareImageByToken(token, "en")).rejects.toThrow(
      NotFoundException,
    );
    expect(service.getPublicSharePage).not.toHaveBeenCalled();
    expect(service.getPublicShareImage).not.toHaveBeenCalled();
  });

  it("resolves the token to its certificate before rendering either public endpoint", async () => {
    const { service, lookup } = makeService();

    await expect(service.getPublicSharePageByToken(token, "en")).resolves.toBe("share page");
    await expect(service.getPublicShareImageByToken(token, "en")).resolves.toEqual(
      Buffer.from("share image"),
    );
    expect(lookup).toHaveBeenCalledWith(token);
    expect(service.getPublicSharePage).toHaveBeenCalledWith("certificate-id", "en");
    expect(service.getPublicShareImage).toHaveBeenCalledWith("certificate-id", "en");
  });
});
