# Tech Stack

## Cloud Infrastructure

- **Provider:** AWS (inferred from S3 integration and SES email adapter)
- **Key Services:** S3 (file storage), SES (email), RDS PostgreSQL, ElastiCache Redis
- **Deployment Regions:** [TBD - TO BE CONFIRMED]

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Language** | TypeScript | 5.4.5 | Primary development language | Strong typing, excellent developer experience, existing codebase standard |
| **Runtime** | Node.js | 20.17.6 | JavaScript runtime | LTS version, matches existing development environment |
| **Framework** | NestJS | 10.0.0 | Backend API framework | Mature DI container, decorator patterns, excellent TypeScript integration |
| **Database ORM** | Drizzle ORM | 0.31.2 | Database access layer | Type-safe queries, excellent TypeScript integration, active in codebase |
| **Database** | PostgreSQL | [TBD - TO BE CONFIRMED] | Primary database | ACID compliance, complex queries, JSON support for flexible schemas |
| **Caching** | Redis | [TBD - TO BE CONFIRMED] | Session/data caching | High-performance caching, existing integration via nestjs-redis |
| **Authentication** | Passport.js | 0.7.0 | Authentication strategies | Multi-strategy support (local, OAuth), NestJS integration |
| **JWT** | @nestjs/jwt | 10.2.0 | Token management | Stateless authentication, established in codebase |
| **Validation** | TypeBox | 0.32.34 | Schema validation | Runtime type checking, existing integration via nestjs-typebox |
| **File Storage** | AWS S3 | via @aws-sdk/client-s3 3.658.1 | File and SCORM content storage | Scalable storage, existing integration |
| **Email** | Multiple Adapters | Nodemailer 6.9.14 + SES | Email delivery | Environment-flexible via factory pattern |
| **Payments** | Stripe | 17.0.0 | Payment processing | Existing integration, webhooks implemented |
| **AI Services** | OpenAI | 5.8.2 + ai-sdk 4.3.17 | AI mentoring features | Core business feature, established integration |
| **Testing** | Jest | 29.5.0 | Unit and integration testing | Comprehensive test suite, NestJS testing utilities |
| **E2E Testing** | Testcontainers | 10.10.3 | Database testing | Real database testing, existing in test infrastructure |
| **Package Manager** | pnpm | (inferred from lockfile) | Monorepo dependency management | Efficient disk usage, monorepo workspace support |
| **Build System** | Turbo | (inferred from config) | Monorepo build orchestration | Efficient caching, parallel builds |
| **Code Quality** | ESLint + Prettier | 8.42.0 + 3.0.0 | Code formatting and linting | Code consistency, existing configuration |
