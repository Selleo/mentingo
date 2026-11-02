const STORAGE_INVALID_RANGE_ERROR_NAME = "InvalidRange";
const HTTP_RANGE_NOT_SATISFIABLE_STATUS = 416;

type StorageErrorShape = { name?: string; $metadata?: { httpStatusCode?: number } };

export const isStorageRangeNotSatisfiableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const { name, $metadata } = error as StorageErrorShape;

  return (
    name === STORAGE_INVALID_RANGE_ERROR_NAME ||
    $metadata?.httpStatusCode === HTTP_RANGE_NOT_SATISFIABLE_STATUS
  );
};
