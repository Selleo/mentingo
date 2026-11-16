import type { Request } from "express";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type ScormContentGrant = {
  actor: CurrentUserType;
  packageId: string;
  extractedFilesReference: string;
  launchPath: string;
  parentOrigin: string;
  /** Set for preview launches, which are authorized by lesson preview access instead of enrollment. */
  previewLessonId?: string;
  expiresAt: number;
};

export type ScormContentAccessScope = Pick<
  ScormContentGrant,
  "packageId" | "actor" | "previewLessonId"
>;

export type ScormContentGrantInput = Omit<ScormContentGrant, "expiresAt">;

export type ScormContentRequest = Request & { scormGrant: ScormContentGrant };

export type ScormContentGrantRequest = Request & { scormGrant?: ScormContentGrant };
