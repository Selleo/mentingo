import slugify from "slugify";

import { isRecord } from "src/common/utils/object.utils";

import { NATIVE_ARCHIVE_DOWNLOAD_FILENAME, NATIVE_ARCHIVE_KIND } from "../native-archive.constants";

import type { NativeArchiveBuildInput } from "../native-archive.types";

export function buildNativeArchiveFilename(input: NativeArchiveBuildInput): string {
  const root =
    input.kind === NATIVE_ARCHIVE_KIND.COURSE
      ? input.courses[input.rootId]?.course
      : input.learningPath;
  if (!isRecord(root)) return NATIVE_ARCHIVE_DOWNLOAD_FILENAME;

  const titles = root.title;
  const title =
    typeof titles === "string"
      ? titles
      : isRecord(titles)
        ? titles[typeof root.baseLanguage === "string" ? root.baseLanguage : "en"]
        : undefined;
  const slug =
    typeof title === "string"
      ? slugify(title, { lower: true, replacement: "-", strict: true, trim: true })
      : "";

  return slug ? `${slug}.zip` : NATIVE_ARCHIVE_DOWNLOAD_FILENAME;
}
