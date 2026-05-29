export type ApiErrorResponse = {
  message: string;
  statusCode?: number;
  retryAfterSeconds?: number;
  translationParams?: Record<string, unknown>;
};

export type EmbedLessonResource = {
  id?: string;
  fileUrl: string;
  allowFullscreen?: boolean;
};
