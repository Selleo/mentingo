import puppeteer from "puppeteer";

export function mockCertificateCdn() {
  const launch = puppeteer.launch.bind(puppeteer);
  jest.spyOn(puppeteer, "launch").mockImplementation(async (options) => {
    const browser = await launch(options);
    const newPage = browser.newPage.bind(browser);
    jest.spyOn(browser, "newPage").mockImplementation(async () => {
      const page = await newPage();
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        // Exercise real PDF generation without depending on Tailwind's external CDN.
        const response =
          request.url() === "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"
            ? request.respond({ status: 200, contentType: "application/javascript", body: "" })
            : request.continue();
        void response.catch(() => {});
      });
      return page;
    });
    return browser;
  });
}
