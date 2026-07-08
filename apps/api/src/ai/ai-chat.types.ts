import type { UUIDType } from "src/common";

export type AiStreamMessageInput = {
  threadId: UUIDType;
  content: string;
  id?: UUIDType;
};
