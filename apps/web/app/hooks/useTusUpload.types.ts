export type StoredTusUpload = {
  uploadId: string;
  tusEndpoint: string;
  tusHeaders: Record<string, string>;
  expiresAt?: string;
  filename: string;
  sizeBytes: number;
  lastModified: number;
};

export type TusResumeAdapter<TSession extends StoredTusUpload> = {
  getUploadForFile: (file: File) => TSession | null;
  saveUpload: (payload: TSession) => void;
  clearUpload: (uploadId: string) => void;
};

export type TusUploadSession = {
  uploadId: string;
  tusEndpoint?: string;
  tusHeaders?: object;
  expiresAt?: string;
  partSize?: number;
};

export type TusUploadArgs<TSession extends TusUploadSession> = {
  file: File;
  session: TSession;
  fingerprintNamespace: string;
  metadata?: Record<string, string>;
  resumeAdapter?: TusResumeAdapter<StoredTusUpload & TSession>;
  uploadingToastKey?: string;
  uploadedToastKey?: string;
  onUploadingStart?: () => void;
  onProgress?: (progress: number) => void;
  onUploaded?: () => void;
  onError?: (error: Error) => void;
};
