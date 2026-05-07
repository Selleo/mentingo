import { SCORM_EXPORT_DEFAULT_LOGO_PATH } from "./runtime-assets";

import type { ScormExportCourseJson, ScormExportCourseSnapshot } from "./types";

export function buildScormExportCourseJson(
  snapshot: ScormExportCourseSnapshot,
): ScormExportCourseJson {
  return {
    schemaVersion: 1,
    course: {
      id: snapshot.id,
      title: snapshot.title,
      description: snapshot.description,
      category: snapshot.category,
      language: snapshot.language,
      thumbnailPath: snapshot.thumbnail?.packagePath ?? null,
      logoPath: snapshot.logo?.packagePath ?? SCORM_EXPORT_DEFAULT_LOGO_PATH,
    },
    theme: snapshot.theme,
    settings: snapshot.settings,
    chapters: snapshot.chapters,
    lessons: snapshot.lessons,
  };
}
