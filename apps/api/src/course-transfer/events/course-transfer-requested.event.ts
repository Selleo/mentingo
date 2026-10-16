export class CourseTransferRequestedEvent {
  constructor(
    public readonly operationId: string,
    public readonly sourceTenantId: string,
  ) {}
}
