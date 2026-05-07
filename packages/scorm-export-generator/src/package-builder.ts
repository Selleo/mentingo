import { PassThrough, Readable } from "node:stream";

import archiver from "archiver";

import { lessonLaunchPath, renderScormExportManifest } from "./manifest-builder";
import { readScormExportRuntimeAssetFiles } from "./runtime-assets";

import { SCORM_EXPORT_LESSON_TYPES, ScormExportCourseJson, ScormExportPackageFile } from "./types";

export type BuildScormExportPackageInput = {
  courseJson: ScormExportCourseJson;
  files?: ScormExportPackageFile[];
};

export type BuildScormExportPackageResult = {
  stream: Readable;
};

export function buildScormExportPackage({
  courseJson,
  files = [],
}: BuildScormExportPackageInput): BuildScormExportPackageResult {
  const packageFiles = buildPackageFiles([...buildRuntimePackageFiles(courseJson), ...files]);
  const output = new PassThrough();
  const zip = archiver("zip", { zlib: { level: 9 } });

  zip.on("error", (error) => output.destroy(error));
  zip.pipe(output);

  zip.append(Buffer.from(renderScormExportManifest({ courseJson, files: packageFiles }), "utf8"), {
    name: "imsmanifest.xml",
  });
  zip.append(Buffer.from(JSON.stringify(courseJson, null, 2), "utf8"), {
    name: "data/course.json",
  });
  packageFiles.forEach((file) => {
    zip.append(resolvePackageFileInput(file), { name: file.path });
  });

  queueMicrotask(() => {
    zip.finalize().catch((error) => output.destroy(error));
  });

  return { stream: output };
}

function resolvePackageFileInput(file: ScormExportPackageFile) {
  if ("buffer" in file) return file.buffer;
  if ("stream" in file) return file.stream;
  return createLazyReadable(file.streamFactory);
}

function createLazyReadable(streamFactory: () => Promise<Readable>) {
  let source: Readable | null = null;
  let loading = false;

  const lazyStream = new Readable({
    read() {
      if (source) {
        source.resume();
        return;
      }

      if (source || loading) return;
      loading = true;

      streamFactory()
        .then((stream) => {
          source = stream;
          stream.on("data", (chunk) => {
            if (!lazyStream.push(chunk)) stream.pause();
          });
          stream.once("end", () => lazyStream.push(null));
          stream.once("error", (error) => lazyStream.destroy(error));
          stream.resume();
        })
        .catch((error) => lazyStream.destroy(error));
    },
  });

  lazyStream.on("resume", () => source?.resume());
  lazyStream.on("pause", () => source?.pause());
  lazyStream.once("close", () => source?.destroy());

  return lazyStream;
}

function buildPackageFiles(files: ScormExportPackageFile[]) {
  const packageFiles = files.sort((left, right) => left.path.localeCompare(right.path));
  const uniqueFiles = new Map<string, ScormExportPackageFile>();

  packageFiles.forEach((file) => {
    if (!uniqueFiles.has(file.path)) {
      uniqueFiles.set(file.path, file);
    }
  });

  return Array.from(uniqueFiles.values());
}

function buildRuntimePackageFiles(courseJson: ScormExportCourseJson) {
  return [...readScormExportRuntimeAssetFiles(), ...buildLessonLaunchFiles(courseJson)];
}

function buildLessonLaunchFiles(courseJson: ScormExportCourseJson): ScormExportPackageFile[] {
  return Object.entries(courseJson.lessons)
    .filter(([, lesson]) => lesson.type !== "scorm")
    .map(([lessonId]) => ({
      path: lessonLaunchPath(lessonId),
      buffer: Buffer.from(renderLessonLaunchHtml(lessonId), "utf8"),
    }));
}

function renderLessonLaunchHtml(lessonId: string) {
  const encodedLessonId = encodeURIComponent(lessonId);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Loading SCORM lesson</title>
    <script>
      window.location.replace("../index.html?lessonId=${encodedLessonId}#lessonId=${encodedLessonId}");
    </script>
  </head>
  <body>
    <a href="../index.html?lessonId=${encodedLessonId}#lessonId=${encodedLessonId}">Open lesson</a>
  </body>
</html>
`;
}
