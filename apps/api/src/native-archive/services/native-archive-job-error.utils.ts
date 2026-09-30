const PUBLIC_ARCHIVE_ERROR_CODES = new Set([
  "nativeArchive.error.accessDenied",
  "nativeArchive.error.archiveTooLarge",
  "nativeArchive.error.assetTooLarge",
  "nativeArchive.error.categoryCreationFailed",
  "nativeArchive.error.categoryNotFound",
  "nativeArchive.error.courseNotFound",
  "nativeArchive.error.createAccessRequired",
  "nativeArchive.error.embeddingUnavailable",
  "nativeArchive.error.fileRequired",
  "nativeArchive.error.invalidArchive",
  "nativeArchive.error.invalidAssetReference",
  "nativeArchive.error.invalidCategory",
  "nativeArchive.error.invalidCourseSnapshot",
  "nativeArchive.error.invalidJob",
  "nativeArchive.error.invalidLearningPath",
  "nativeArchive.error.invalidLiveTraining",
  "nativeArchive.error.invalidUpload",
  "nativeArchive.error.invalidUploadChunk",
  "nativeArchive.error.invalidUploadLength",
  "nativeArchive.error.jobNotFound",
  "nativeArchive.error.liveTrainingIncomplete",
  "nativeArchive.error.liveTrainingNotFound",
  "nativeArchive.error.liveTrainingUnavailable",
  "nativeArchive.error.missingAsset",
  "nativeArchive.error.notReady",
  "nativeArchive.error.pathNotFound",
  "nativeArchive.error.storageUnavailable",
  "nativeArchive.error.unsupportedLanguage",
  "nativeArchive.error.unsupportedTusVersion",
  "nativeArchive.error.unsupportedVersion",
  "nativeArchive.error.uploadComplete",
  "nativeArchive.error.uploadIncomplete",
  "nativeArchive.error.uploadNotFound",
]);

export function toPublicArchiveFailureCode(failedReason?: string | null): string | null {
  if (!failedReason) return null;

  return PUBLIC_ARCHIVE_ERROR_CODES.has(failedReason)
    ? failedReason
    : "nativeArchive.error.invalidArchive";
}
