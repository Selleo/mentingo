import { getRemoteInputProtocolWhitelist } from "../videoThumbnail";

describe("getRemoteInputProtocolWhitelist", () => {
  it("allows only TLS transports for HTTPS storage URLs", () => {
    expect(
      getRemoteInputProtocolWhitelist("https://bucket.s3.amazonaws.com/video.mp4?X-Amz=1"),
    ).toBe("https,tls,tcp,crypto");
  });

  it("allows plain HTTP transports for HTTP storage URLs", () => {
    expect(getRemoteInputProtocolWhitelist("http://localhost:9100/bucket/video.mp4")).toBe(
      "http,tcp,crypto",
    );
  });

  it.each(["file:///etc/passwd", "concat:/etc/passwd", "ftp://example.com/video.mp4"])(
    "rejects unsupported input protocol %s",
    (inputUrl) => {
      expect(() => getRemoteInputProtocolWhitelist(inputUrl)).toThrow(
        "Unsupported thumbnail input protocol",
      );
    },
  );
});
