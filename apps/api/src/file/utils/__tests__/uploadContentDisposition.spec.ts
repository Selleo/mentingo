import { uploadContentDisposition } from "../uploadContentDisposition";

describe("uploadContentDisposition", () => {
  it.each(["image/png", "image/webp", "IMAGE/JPEG; charset=binary", "video/mp4", "audio/mpeg"])(
    "renders passive media %s inline",
    (contentType) => {
      expect(uploadContentDisposition(contentType)).toBe("inline");
    },
  );

  it.each([
    "image/svg+xml",
    "text/html",
    "application/xml",
    "application/pdf",
    "text/csv",
    undefined,
  ])("downloads active or document content %s as an attachment", (contentType) => {
    expect(uploadContentDisposition(contentType)).toBe("attachment");
  });
});
