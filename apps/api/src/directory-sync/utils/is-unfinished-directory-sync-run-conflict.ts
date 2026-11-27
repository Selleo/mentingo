import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  DIRECTORY_SYNC_UNFINISHED_RUN_CONSTRAINT,
  POSTGRES_UNIQUE_VIOLATION_CODE,
} from "../directory-sync.constants";

const unfinishedRunConflictSchema = Type.Object({
  code: Type.Literal(POSTGRES_UNIQUE_VIOLATION_CODE),
  constraint_name: Type.Literal(DIRECTORY_SYNC_UNFINISHED_RUN_CONSTRAINT),
});

const errorWithCauseSchema = Type.Object({ cause: Type.Unknown() });

/** True when another queued or running sync already holds the connection. */
export function isUnfinishedDirectorySyncRunConflict(error: unknown): boolean {
  if (Value.Check(unfinishedRunConflictSchema, error)) return true;
  if (Value.Check(errorWithCauseSchema, error)) {
    return isUnfinishedDirectorySyncRunConflict(error.cause);
  }

  return false;
}
