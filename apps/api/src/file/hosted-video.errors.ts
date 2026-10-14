export class HostedVideoCopyInProgressError extends Error {
  constructor(sourceReference: string) {
    super(`Another transfer is still uploading a copy of ${sourceReference}`);
    this.name = HostedVideoCopyInProgressError.name;
  }
}
