# Error Handling Strategy

## General Approach
- **Error Model:** NestJS exception hierarchy with custom business exceptions
- **Exception Hierarchy:** HttpException → Custom domain exceptions → Specific error types
- **Error Propagation:** Exceptions bubble up through service layers with appropriate transformation

## Logging Standards
- **Library:** NestJS built-in Logger [TBD - SPECIFIC VERSION TO BE CONFIRMED]
- **Format:** Structured JSON logging for production environments
- **Levels:** Error, Warn, Log, Debug, Verbose
- **Required Context:**
  - Correlation ID: Request-scoped UUID for tracing
  - Service Context: Module/service name and method
  - User Context: User ID (when authenticated), role, and session info

## Error Handling Patterns

### External API Errors
- **Retry Policy:** Exponential backoff for transient failures (OpenAI, Stripe, OAuth providers)
- **Circuit Breaker:** [TBD - TO BE IMPLEMENTED] for protecting against cascading failures
- **Timeout Configuration:** Service-specific timeouts (OpenAI: 30s, Stripe: 15s, OAuth: 10s)
- **Error Translation:** External API errors mapped to internal error codes and user-friendly messages

### Business Logic Errors
- **Custom Exceptions:** Domain-specific exceptions (CourseNotFoundException, InsufficientPermissionsException)
- **User-Facing Errors:** Localized error messages with actionable guidance
- **Error Codes:** Structured error code system (AUTH_001, COURSE_002, etc.)

### Data Consistency
- **Transaction Strategy:** Database transactions for multi-table operations with automatic rollback
- **Compensation Logic:** Event-driven saga pattern for cross-domain operations
- **Idempotency:** Request idempotency keys for payment processing and critical operations
