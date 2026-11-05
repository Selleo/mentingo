import {
  getCertificateImageDataUri,
  handleCertificateRequest,
  prepareCertificatePage,
} from "./certificate-renderer";

import type { HTTPRequest, Page } from "puppeteer";

describe("certificate renderer policy", () => {
  it("disables JavaScript and intercepts requests before returning the page", async () => {
    const calls: string[] = [];
    const page = {
      setJavaScriptEnabled: jest.fn(async () => {
        calls.push("javascript");
      }),
      setRequestInterception: jest.fn(async () => {
        calls.push("interception");
      }),
      on: jest.fn(() => {
        calls.push("handler");
      }),
    };
    await prepareCertificatePage(page as unknown as Page);
    expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
    expect(calls).toEqual(["javascript", "interception", "handler"]);
    expect(page.on).toHaveBeenCalledWith("request", handleCertificateRequest);
  });

  it.each([
    ["data:image/png;base64,AA==", true],
    ["blob:null/image", true],
    ["http://127.0.0.1:8025/", false],
    ["https://example.test/", false],
    ["http://169.254.169.254/latest/meta-data/", false],
    ["file:///etc/hosts", false],
    ["ftp://internal/file", false],
    ["about:blank", false],
  ])("handles %s with embedded=%s", async (url, embedded) => {
    const request = {
      url: () => url,
      isInterceptResolutionHandled: () => false,
      continue: jest.fn().mockResolvedValue(undefined),
      abort: jest.fn().mockResolvedValue(undefined),
    };
    await handleCertificateRequest(request as unknown as HTTPRequest);
    expect(request.continue).toHaveBeenCalledTimes(embedded ? 1 : 0);
    expect(request.abort).toHaveBeenCalledTimes(embedded ? 0 : 1);
  });

  it("propagates policy setup failure", async () => {
    const page = { setJavaScriptEnabled: jest.fn().mockRejectedValue(new Error("closed")) };
    await expect(prepareCertificatePage(page as unknown as Page)).rejects.toThrow("closed");
  });
});

describe("certificate embedded images", () => {
  const fileService = {
    getFileContentType: jest.fn(),
    getRawFileBuffer: jest.fn(),
  };
  beforeEach(() => {
    jest.resetAllMocks();
    fileService.getFileContentType.mockResolvedValue("image/png");
    fileService.getRawFileBuffer.mockResolvedValue(Buffer.from("image"));
  });

  it("loads a storage key as a data URI", async () => {
    await expect(getCertificateImageDataUri(fileService, "tenant/logo.png")).resolves.toBe(
      "data:image/png;base64,aW1hZ2U=",
    );
    expect(fileService.getRawFileBuffer).toHaveBeenCalledWith("tenant/logo.png");
  });

  it.each([
    null,
    "",
    "https://attacker.test/a",
    "http://127.0.0.1/a",
    "file:///etc/hosts",
    "//internal/a",
    " https://internal/a",
    "data:image/png;base64,AA==",
  ])("does not fetch a non-storage reference: %s", async (reference) => {
    await expect(getCertificateImageDataUri(fileService, reference)).resolves.toBeNull();
    expect(fileService.getRawFileBuffer).not.toHaveBeenCalled();
    expect(fileService.getFileContentType).not.toHaveBeenCalled();
  });

  it("rejects non-image content", async () => {
    fileService.getFileContentType.mockResolvedValue("text/html");
    await expect(getCertificateImageDataUri(fileService, "tenant/file")).resolves.toBeNull();
    expect(fileService.getRawFileBuffer).not.toHaveBeenCalled();
  });

  it("omits a missing optional image", async () => {
    fileService.getRawFileBuffer.mockRejectedValue(new Error("missing"));
    await expect(getCertificateImageDataUri(fileService, "tenant/missing.png")).resolves.toBeNull();
  });
});
