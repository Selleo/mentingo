# Test Strategy and Standards

## Testing Philosophy
- **Approach:** Test-driven development encouraged, comprehensive test coverage required
- **Coverage Goals:** Minimum 80% code coverage, 100% for critical business logic
- **Test Pyramid:** 70% unit tests, 20% integration tests, 10% E2E tests

## Test Types and Organization

### Unit Tests
- **Framework:** Jest 29.5.0 with NestJS testing utilities
- **File Convention:** `*.spec.ts` in domain `__tests__/` folders
- **Location:** Co-located with source code in domain directories
- **Mocking Library:** Jest built-in mocking with custom test doubles
- **Coverage Requirement:** 80% minimum for services and repositories

### Integration Tests
- **Scope:** Multi-service interactions, database operations, external API integrations
- **Location:** `/test` directory with dedicated test infrastructure
- **Test Infrastructure:**
  - **PostgreSQL:** Testcontainers for isolated database testing
  - **Redis:** In-memory Redis for caching tests
  - **External APIs:** WireMock for API mocking (OpenAI, Stripe, OAuth providers)
  - **File Storage:** Local S3-compatible storage (MinIO) for file upload tests

### End-to-End Tests
- **Framework:** Jest with Supertest for HTTP testing
- **Scope:** Complete user workflows (registration → course enrollment → lesson completion)
- **Environment:** Isolated test database with factory-generated test data
- **Test Data:** Test factories in `/test/factory/` for consistent data generation

## Test Data Management
- **Strategy:** Factory-based test data generation with Fishery library
- **Fixtures:** JSON fixtures for complex scenarios in `/test/fixtures/`
- **Factories:** Domain-specific factories (UserFactory, CourseFactory, ChapterFactory)
- **Cleanup:** Automatic test database truncation between test suites

## Continuous Testing
- **CI Integration:** Automated test execution on pull requests and main branch
- **Performance Tests:** [TBD - TO BE IMPLEMENTED] for API endpoint performance
- **Security Tests:** [TBD - TO BE IMPLEMENTED] for vulnerability scanning
