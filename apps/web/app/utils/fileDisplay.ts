const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/msword": "DOC",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.ms-powerpoint": "PPT",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/svg+xml": "SVG",
  "text/csv": "CSV",
  "text/plain": "TXT",
  "video/mp4": "MP4",
  "video/quicktime": "MOV",
} as const;

export const getReadableFileTypeLabel = (contentType: string) => {
  const mappedLabel = FILE_TYPE_LABELS[contentType];

  if (mappedLabel) return mappedLabel;

  const [, subtype] = contentType.split("/");

  return subtype?.toUpperCase() ?? contentType;
};
