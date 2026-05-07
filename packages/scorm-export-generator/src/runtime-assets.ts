import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  SCORM_EXPORT_DEFAULT_LOGO_PATH,
  SCORM_EXPORT_RUNTIME_PLAYER_FILES,
  SCORM_EXPORT_RUNTIME_VERSION,
  SCORM_EXPORT_SUPPORTED_VIDEO_PROVIDERS,
} from "@repo/scorm-export-runtime";

export {
  SCORM_EXPORT_DEFAULT_LOGO_PATH,
  SCORM_EXPORT_RUNTIME_PLAYER_FILES,
  SCORM_EXPORT_RUNTIME_VERSION,
  SCORM_EXPORT_SUPPORTED_VIDEO_PROVIDERS,
};

export type ScormExportRuntimeAsset = {
  sourcePath: string;
  packagePath: string;
};

const require = createRequire(
  typeof __filename === "string" ? __filename : `${process.cwd()}/package.json`,
);

export function getScormExportRuntimeAssets(): ScormExportRuntimeAsset[] {
  return SCORM_EXPORT_RUNTIME_PLAYER_FILES.map((packagePath: string) => ({
    sourcePath: packagePath,
    packagePath,
  }));
}

export function readScormExportRuntimeAssetFiles() {
  return getScormExportRuntimeAssets().map((asset) => ({
    path: asset.packagePath,
    buffer: readFileSync(require.resolve(`@repo/scorm-export-runtime/${asset.sourcePath}`)),
  }));
}
