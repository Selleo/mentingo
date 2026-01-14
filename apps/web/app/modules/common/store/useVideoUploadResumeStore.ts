import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StoredVideoUpload = {
  uploadId: string;
  bunnyGuid: string;
  fileKey: string;
  tusEndpoint: string;
  tusHeaders: Record<string, string>;
  expiresAt: string;
  filename: string;
  sizeBytes: number;
  lastModified: number;
  resourceId?: string;
};

type VideoUploadResumeState = {
  uploads: Record<string, StoredVideoUpload>;
  saveUpload: (payload: StoredVideoUpload) => void;
  clearUpload: (uploadId: string) => void;
  pruneExpiredUploads: () => void;
  getUploadForFile: (file: File) => StoredVideoUpload | null;
};

const isExpired = (expiresAt: string, now: number) => {
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isNaN(expiresAtMs) || expiresAtMs <= now;
};

const matchesFile = (entry: StoredVideoUpload, file: File) =>
  entry.filename === file.name &&
  entry.sizeBytes === file.size &&
  entry.lastModified === file.lastModified;

const pruneUploads = (uploads: Record<string, StoredVideoUpload>) => {
  const now = Date.now();

  return Object.fromEntries(
    Object.entries(uploads).filter(([, entry]) => !isExpired(entry.expiresAt, now)),
  );
};

export const useVideoUploadResumeStore = create<VideoUploadResumeState>()(
  persist(
    (set, get) => ({
      uploads: {},
      saveUpload: (payload) =>
        set((state) => ({ uploads: { ...state.uploads, [payload.uploadId]: payload } })),
      clearUpload: (uploadId) =>
        set((state) => {
          const next = { ...state.uploads };
          delete next[uploadId];
          return { uploads: next };
        }),
      pruneExpiredUploads: () =>
        set((state) => ({
          uploads: pruneUploads(state.uploads),
        })),
      getUploadForFile: (file) => {
        const { uploads } = get();
        const now = Date.now();

        const next: Record<string, StoredVideoUpload> = {};

        let match: StoredVideoUpload | null = null;

        for (const [uploadId, entry] of Object.entries(uploads)) {
          if (isExpired(entry.expiresAt, now)) continue;

          next[uploadId] = entry;

          if (matchesFile(entry, file)) match = entry;
        }

        if (Object.keys(next).length !== Object.keys(uploads).length) set({ uploads: next });

        return match;
      },
    }),
    {
      name: "video-upload-resume-storage",
    },
  ),
);
