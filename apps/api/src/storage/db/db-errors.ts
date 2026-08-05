export class MissingTenantContextError extends Error {
  constructor() {
    super("Tenant context is required for tenant-scoped database work");
    this.name = MissingTenantContextError.name;
  }
}

export class TenantContextConflictError extends Error {
  constructor(activeTenantId: string, requestedTenantId: string) {
    super(`Cannot switch tenant context from ${activeTenantId} to ${requestedTenantId}`);
    this.name = TenantContextConflictError.name;
  }
}
