export class DirectoryProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectoryProviderNotConfiguredError";
  }
}

export class DirectoryProviderAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectoryProviderAccessDeniedError";
  }
}

/** The run was closed as stale or its connection was disconnected while it was working. */
export class DirectorySyncRunInterruptedError extends Error {
  constructor(runId: string) {
    super(`Directory sync run ${runId} is no longer running`);
    this.name = "DirectorySyncRunInterruptedError";
  }
}

/** Groups or org units used by the connection no longer exist in the directory. */
export class DirectoryObjectsNotFoundError extends Error {
  constructor(public readonly missingExternalIds: string[]) {
    super(`Directory objects no longer exist: ${missingExternalIds.join(", ")}`);
    this.name = "DirectoryObjectsNotFoundError";
  }
}
