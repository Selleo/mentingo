/** Human-readable binary size used in upload limits shown to users, e.g. "20 MB". */
export const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"] as const;

  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const roundedValue = Number.isInteger(value) ? value : Number(value.toFixed(1));

  return `${roundedValue} ${units[unitIndex]}`;
};
