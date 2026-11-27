import { BadRequestException } from "@nestjs/common";
import { DIRECTORY_SYNC_ERROR_KEYS } from "@repo/shared";
import { match, P } from "ts-pattern";

import {
  DirectoryProviderAccessDeniedError,
  DirectoryProviderNotConfiguredError,
  DirectoryObjectsNotFoundError,
} from "../directory-sync.errors";

/** Turns provider errors that an admin can fix into translated bad requests. */
export function translateDirectoryProviderError(error: unknown): unknown {
  return match(error)
    .with(
      P.instanceOf(DirectoryProviderNotConfiguredError),
      () => new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.SERVICE_ACCOUNT_KEY_MISSING),
    )
    .with(
      P.instanceOf(DirectoryProviderAccessDeniedError),
      () => new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.DIRECTORY_ACCESS_DENIED),
    )
    .with(
      P.instanceOf(DirectoryObjectsNotFoundError),
      () => new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.SCOPE_NOT_FOUND),
    )
    .otherwise(() => error);
}
