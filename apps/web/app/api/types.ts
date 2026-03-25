export type ApiErrorResponse = {
  message: string;
  statusCode?: number;
  retryAfterSeconds?: number;
};

export type EmbedLessonResource = {
  id?: string;
  fileUrl: string;
  allowFullscreen?: boolean;
};
