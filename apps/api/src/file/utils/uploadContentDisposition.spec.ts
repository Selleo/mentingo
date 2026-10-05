import { uploadContentDisposition } from "./uploadContentDisposition";

describe("storage content disposition", () => {
  it.each([
    ["image/svg+xml", "attachment"],
    ["application/pdf", "attachment"],
    ["text/plain", "attachment"],
    ["IMAGE/WEBP; charset=binary", "inline"],
    ["video/mp4", "inline"],
    [undefined, "attachment"],
  ])("classifies %s as %s", (mime, disposition) => {
    expect(uploadContentDisposition(mime)).toBe(disposition);
  });
});
