# Source Tree

**Repository Type:** Turbo-powered monorepo with clear separation of concerns
**Organization Pattern:** Apps + packages structure for scalability and shared dependencies

```plaintext
mentingo/
├── apps/                                    # Application services
│   ├── api/                                # Backend NestJS API service
│   │   ├── src/
│   │   │   ├── main.ts                     # Application bootstrap
│   │   │   ├── app.module.ts               # Root NestJS module
│   │   │   ├── auth/                       # Authentication domain
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts      # Login, register, OAuth endpoints
│   │   │   │   ├── auth.service.ts         # Authentication business logic
│   │   │   │   ├── token.service.ts        # JWT token management
│   │   │   │   ├── reset-password.service.ts
│   │   │   │   ├── create-password.service.ts
│   │   │   │   ├── schemas/                # Validation schemas
│   │   │   │   │   ├── login.schema.ts
│   │   │   │   │   ├── create-account.schema.ts
│   │   │   │   │   └── password.schema.ts
│   │   │   │   ├── strategy/               # Passport.js strategies
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   ├── local.strategy.ts
│   │   │   │   │   ├── google.strategy.ts
│   │   │   │   │   └── microsoft.strategy.ts
│   │   │   │   └── __tests__/              # Domain-specific tests
│   │   │   ├── courses/                    # Course management domain
│   │   │   │   ├── course.module.ts
│   │   │   │   ├── course.controller.ts    # Course CRUD endpoints
│   │   │   │   ├── course.service.ts       # Business logic
│   │   │   │   ├── schemas/                # Request/response schemas
│   │   │   │   ├── validations/            # Business rule validations
│   │   │   │   └── __tests__/
│   │   │   ├── lesson/                     # Learning content domain
│   │   │   │   ├── lesson.module.ts
│   │   │   │   ├── lesson.controller.ts
│   │   │   │   ├── services/               # Service layer separation
│   │   │   │   │   ├── lesson.service.ts   # Student-facing services
│   │   │   │   │   └── adminLesson.service.ts # Admin services
│   │   │   │   ├── repositories/           # Data access layer
│   │   │   │   │   ├── lesson.repository.ts
│   │   │   │   │   └── adminLesson.repository.ts
│   │   │   │   ├── lesson.schema.ts
│   │   │   │   └── lesson.type.ts
│   │   │   ├── chapter/                    # Chapter management
│   │   │   │   ├── chapter.module.ts
│   │   │   │   ├── chapter.controller.ts
│   │   │   │   ├── chapter.service.ts
│   │   │   │   ├── adminChapter.service.ts
│   │   │   │   ├── repositories/
│   │   │   │   └── schemas/
│   │   │   ├── ai/                         # AI mentoring domain
│   │   │   │   ├── ai.module.ts
│   │   │   │   ├── ai.controller.ts
│   │   │   │   ├── services/               # Multiple AI services
│   │   │   │   │   ├── ai.service.ts       # Main AI orchestration
│   │   │   │   │   ├── chat.service.ts     # Conversation management
│   │   │   │   │   ├── message.service.ts  # Message handling
│   │   │   │   │   ├── thread.service.ts   # Thread management
│   │   │   │   │   ├── prompt.service.ts   # Prompt engineering
│   │   │   │   │   ├── judge.service.ts    # Response evaluation
│   │   │   │   │   ├── summary.service.ts  # Content summarization
│   │   │   │   │   └── token.service.ts    # Token counting/management
│   │   │   │   ├── repositories/
│   │   │   │   │   └── ai.repository.ts
│   │   │   │   ├── utils/                  # AI-specific utilities
│   │   │   │   │   ├── ai.schema.ts
│   │   │   │   │   ├── ai.tools.ts
│   │   │   │   │   ├── ai.config.ts
│   │   │   │   │   └── ai.type.ts
│   │   │   │   └── __tests__/
│   │   │   ├── user/                       # User management domain
│   │   │   ├── questions/                  # Quiz/assessment domain
│   │   │   ├── studentLessonProgress/      # Progress tracking
│   │   │   ├── statistics/                 # Analytics domain
│   │   │   ├── stripe/                     # Payment processing
│   │   │   ├── file/                       # File management
│   │   │   ├── s3/                         # AWS S3 integration
│   │   │   ├── scorm/                      # SCORM package handling
│   │   │   ├── settings/                   # Global platform settings
│   │   │   ├── category/                   # Course categorization
│   │   │   ├── group/                      # User group management
│   │   │   ├── cache/                      # Redis caching
│   │   │   ├── bunny/                      # BunnyStream integration
│   │   │   ├── health/                     # Health checks
│   │   │   ├── sentry/                     # Error monitoring
│   │   │   ├── storage/                    # Database layer
│   │   │   │   ├── migrations/             # Database migrations (28+)
│   │   │   │   │   ├── 0000_initial.sql
│   │   │   │   │   ├── ...
│   │   │   │   │   ├── 0028_latest.sql
│   │   │   │   │   └── meta/               # Migration metadata
│   │   │   │   └── schema/                 # Drizzle ORM schemas
│   │   │   │       ├── index.ts            # All table definitions
│   │   │   │       └── utils.ts            # Schema utilities
│   │   │   ├── events/                     # Event-driven communication
│   │   │   │   ├── events.module.ts
│   │   │   │   ├── index.ts                # Event exports
│   │   │   │   ├── user/                   # User domain events
│   │   │   │   ├── course/
│   │   │   │   ├── lesson/
│   │   │   │   └── quiz/
│   │   │   ├── common/                     # Shared utilities
│   │   │   │   ├── configuration/          # Environment configs
│   │   │   │   ├── decorators/             # Custom decorators
│   │   │   │   ├── guards/                 # Security guards
│   │   │   │   ├── emails/                 # Email system
│   │   │   │   │   ├── adapters/           # Multi-provider support
│   │   │   │   │   │   ├── ses.adapter.ts   # AWS SES
│   │   │   │   │   │   ├── smtp.adapter.ts  # SMTP
│   │   │   │   │   │   └── local.adapter.ts # Development
│   │   │   │   │   └── factory/
│   │   │   │   ├── helpers/                # Utility functions
│   │   │   │   ├── schemas/                # Shared schemas
│   │   │   │   ├── queries/                # Shared queries
│   │   │   │   └── types.ts
│   │   │   ├── utils/                      # Application utilities
│   │   │   │   ├── types/                  # Type definitions
│   │   │   │   ├── pipes/
│   │   │   │   └── __tests__/
│   │   │   ├── seed/                       # Database seeding
│   │   │   ├── test-config/                # Test configuration
│   │   │   └── swagger/                    # API documentation
│   │   ├── test/                           # Testing infrastructure
│   │   │   ├── jest-setup.ts               # Unit test setup
│   │   │   ├── jest-e2e-setup.ts          # E2E test setup
│   │   │   ├── helpers/                   # Test helpers
│   │   │   └── factory/                   # Test data factories
│   │   ├── package.json                   # Backend dependencies
│   │   ├── tsconfig.json                  # TypeScript config
│   │   ├── nest-cli.json                  # NestJS CLI config
│   │   ├── jest.config.ts                 # Jest test config
│   │   ├── drizzle.config.ts             # Drizzle ORM config
│   │   └── .env.example                  # Environment template
│   ├── web/                              # Frontend application
│   └── reverse-proxy/                    # Nginx reverse proxy
├── packages/                             # Shared packages
│   └── @repo/email-templates/            # Email template workspace
├── web-bundles/                         # Frontend build artifacts
├── .bmad-core/                          # BMaD framework files
├── .claude/                            # Claude Code configuration
├── .husky/                             # Git hooks
├── .github/                            # GitHub workflows
├── test-results/                       # E2E test outputs
├── docs/                               # Documentation
│   └── architecture.md                # This document
├── turbo.json                          # Turbo build configuration
├── pnpm-workspace.yaml                 # PNPM workspace config
├── package.json                        # Root package.json
├── docker-compose.yml                  # Local development
├── docker-compose.test.yml             # Test environment
├── api.Dockerfile                      # API container build
├── web.Dockerfile                      # Web container build
└── README.md                           # Project overview
```
