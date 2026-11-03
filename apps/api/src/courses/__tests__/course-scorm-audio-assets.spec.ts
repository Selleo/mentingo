import { Readable } from "node:stream";

import { CourseScormAssetsService } from "../scorm-export/course-scorm-assets.service";

import type { ScormExportCourseSnapshot } from "@repo/scorm-export-generator";

describe("SCORM lesson audio assets", () => {
  it("packages podcast assets lazily as streams and rewrites stable references", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const getRawFileBuffer = jest.fn();
    const getFileStream = jest.fn(async () => ({ stream: Readable.from(["audio"]) }));
    const service = new CourseScormAssetsService(
      { getRawFileBuffer, getFileStream } as never,
      {} as never,
    );
    const asset = {
      id,
      type: "attachment",
      contentType: "audio/mpeg",
      sourceReference: "tenant/audio.mp3",
      packagePath: "assets/audio.mp3",
    };
    const result = await service.collectAssets({
      lessons: {
        lesson: {
          type: "content",
          html: `<div data-node-type="audio" data-src="/api/lesson/lesson-resource/${id}"></div>`,
          assets: [asset],
        },
      },
    } as unknown as ScormExportCourseSnapshot);
    expect(getRawFileBuffer).not.toHaveBeenCalled();
    expect(getFileStream).not.toHaveBeenCalled();
    expect(result.files).toHaveLength(1);
    const file = result.files[0];
    if (!("streamFactory" in file)) throw new Error("Podcast export must use a stream factory");
    expect(file.streamFactory).toBeInstanceOf(Function);
    const stream = await file.streamFactory();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("audio");
    expect(getFileStream).toHaveBeenCalledWith("tenant/audio.mp3");
    expect((result.snapshot.lessons.lesson as { html: string }).html).toContain(
      'data-src="../assets/audio.mp3"',
    );
  });
});
