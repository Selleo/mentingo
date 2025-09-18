# Security

## Input Validation
- **Validation Library:** TypeBox with nestjs-typebox integration
- **Validation Location:** All validation at API boundary before business logic processing
- **Required Rules:**
  - All external inputs MUST be validated against schemas
  - Whitelist approach preferred over blacklist for acceptable inputs
  - SQL injection prevention through parameterized queries (Drizzle ORM handles this)

## Authentication & Authorization
- **Auth Method:** JWT-based stateless authentication with refresh token rotation
- **Session Management:** Redis-based session storage for OAuth state and rate limiting
- **Required Patterns:**
  - All endpoints except public routes MUST be protected by JWT guard
  - Role-based access control using custom roles guard
  - OAuth callback validation with CSRF protection

## Secrets Management
- **Development:** Environment variables in `.env` files (not committed)
- **Production:** [TBD - TO BE CONFIRMED - AWS Secrets Manager, HashiCorp Vault, or similar]
- **Code Requirements:**
  - NEVER hardcode secrets in source code
  - Access secrets only via NestJS ConfigService
  - No secrets in logs, error messages, or API responses

## API Security
- **Rate Limiting:** [TBD - TO BE IMPLEMENTED] per-user and per-endpoint rate limits
- **CORS Policy:** Restrictive CORS configuration for production environments
- **Security Headers:** Helmet.js integration for security headers (CSP, HSTS, etc.)
- **HTTPS Enforcement:** TLS 1.2+ required for all production traffic

## Data Protection
- **Encryption at Rest:** Database encryption via cloud provider (AWS RDS encryption)
- **Encryption in Transit:** HTTPS/TLS for all API communication, encrypted database connections
- **PII Handling:** Personal data minimization, explicit consent for data collection
- **Logging Restrictions:** Never log passwords, tokens, or sensitive personal information

## Dependency Security
- **Scanning Tool:** npm audit for vulnerability scanning
- **Update Policy:** Regular dependency updates with security patch priority
- **Approval Process:** Security review for new dependencies, especially those with file system or network access

## Security Testing
- **SAST Tool:** [TBD - TO BE IMPLEMENTED] for static code analysis
- **DAST Tool:** [TBD - TO BE IMPLEMENTED] for dynamic application security testing
- **Penetration Testing:** [TBD - TO BE SCHEDULED] regular security assessments
