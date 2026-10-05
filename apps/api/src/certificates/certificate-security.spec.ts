import puppeteer from "puppeteer";

import {
  buildCertificateHtmlDocument,
  buildCertificateMarkup,
  defaultCertificateRenderTheme,
  normalizeCertificateColor,
} from "../../../../packages/shared/src/utils/certificate";
import {
  prepareCertificatePage,
  imageDataUri,
  isSafeCertificateAssetKey,
} from "../common/utils/certificate-renderer";

describe("certificate rendering boundary", () => {
  it("rejects CSS declarations in public share theme colors", () => {
    expect(normalizeCertificateColor("#123abc", "#000000")).toBe("#123abc");
    expect(normalizeCertificateColor("red;background:url(https://evil)", "#000000")).toBe(
      "#000000",
    );
  });
  it("escapes every occurrence of markup and blocks injected CSS colors and URLs", () => {
    const html = buildCertificateMarkup({
      studentName: `A & B & <img src=x onerror=alert(1)> <script>alert(1)</script>`,
      courseName: `"'><svg onload=alert(1)>`,
      backgroundImageUrl: `data:image/png;base64,a\\" );color:red;(\n`,
      colorTheme: {
        ...defaultCertificateRenderTheme,
        titleColor: `red; background:url(https://evil)`,
      },
    });
    expect(html).toContain("A &amp; B &amp; &lt;img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("background-image:url(&quot;");
    expect(html).toContain("\\);color:red;");
    expect(html).toContain("color:#000000;");
    expect(html).not.toContain("<svg onload");
  });

  it("uses only inline CSS and a restrictive CSP", () => {
    const html = buildCertificateHtmlDocument(buildCertificateMarkup({}));
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("frame-src 'none'");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).toContain(".text-\\[62px\\]");
    expect(html).toContain(".gap-y-12");
  });

  it("turns only nonempty verified raster images and safe storage keys into data URIs", () => {
    expect(
      imageDataUri(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), "image/png"),
    ).toMatch(/^data:image\/png;base64,/);
    expect(imageDataUri(Buffer.from("<svg onload=alert(1)>"), "image/svg+xml")).toBeNull();
    expect(imageDataUri(Buffer.from("bad"), "image/png")).toBeNull();
    for (const key of [
      "https://host/x",
      "//host/x",
      " key",
      "key ",
      "data:image/png,x",
      "file:///etc/passwd",
    ]) {
      expect(isSafeCertificateAssetKey(key)).toBe(false);
    }
    expect(isSafeCertificateAssetKey("tenant/images/logo.png")).toBe(true);
  });

  it("disables JavaScript and aborts external requests before setting content", async () => {
    let handler: (request: any) => Promise<void> = async () => {};
    const calls: string[] = [];
    const page = {
      setJavaScriptEnabled: jest.fn(async () => calls.push("js")),
      setRequestInterception: jest.fn(async () => calls.push("interception")),
      on: jest.fn((_event, cb) => {
        handler = cb;
      }),
      setContent: jest.fn(async () => calls.push("content")),
      waitForSelector: jest.fn(async () => {}),
      waitForFunction: jest.fn(async () => {}),
    };
    await prepareCertificatePage(page as never, "<body><div>test</div></body>");
    expect(calls).toEqual(["js", "interception", "content"]);
    const abort = jest.fn();
    const continueRequest = jest.fn();
    await handler({
      url: () => "http://169.254.169.254/latest",
      isInterceptResolutionHandled: () => false,
      abort,
      continue: continueRequest,
    });
    expect(abort).toHaveBeenCalled();
    await handler({
      url: () => "data:image/png;base64,AA==",
      isInterceptResolutionHandled: () => false,
      abort,
      continue: continueRequest,
    });
    expect(continueRequest).toHaveBeenCalled();
    abort.mockClear();
    continueRequest.mockClear();
    await handler({
      url: () => "http://localhost/private",
      isInterceptResolutionHandled: () => true,
      abort,
      continue: continueRequest,
    });
    expect(abort).not.toHaveBeenCalled();
    expect(continueRequest).not.toHaveBeenCalled();
  });

  it("renders with Chromium without executing scripts or reaching a remote host", async () => {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const outgoing: string[] = [];
      page.on("request", (request) => {
        if (request.url().startsWith("http")) outgoing.push(request.url());
      });
      await prepareCertificatePage(
        page,
        buildCertificateHtmlDocument(
          buildCertificateMarkup({
            studentName: `<img src="https://example.org/escape" onerror="alert(1)">`,
            backgroundImageUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl0fWgAAAAASUVORK5CYII=",
          }),
        ),
      );
      expect(await page.evaluate(() => document.body.textContent)).toContain(
        '<img src="https://example.org/escape"',
      );
      expect(outgoing).toEqual([]);
      expect(
        Buffer.from(await page.pdf())
          .subarray(0, 5)
          .toString(),
      ).toBe("%PDF-");
      const blocked = await browser.newPage();
      const failures: string[] = [];
      blocked.on("requestfailed", (request) => failures.push(request.url()));
      await expect(
        prepareCertificatePage(
          blocked,
          '<html><body><img src="http://127.0.0.1:1/private"></body></html>',
        ),
      ).rejects.toThrow();
      expect(failures).toContain("http://127.0.0.1:1/private");
    } finally {
      await browser.close();
    }
  }, 30_000);
});
