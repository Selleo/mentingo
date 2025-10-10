# Enterprise Coding Standards for Mentingo

## Core Standards
- **Languages & Runtimes:** TypeScript 5.4.5, Node.js 20.17.6 (LTS)
- **Framework:** NestJS with modular architecture and dependency injection
- **Database:** Drizzle ORM with PostgreSQL, type-safe queries and transactions
- **Style & Linting:** ESLint 8.42.0 + Prettier 3.0.0 with project-specific configurations
- **Test Organization:** Domain co-located unit tests (`__tests__/` folders), E2E tests in `/test` directory

## 🏗️ Architectural Patterns

### NestJS Module Architecture
- **Module Organization**: Group related functionality into cohesive modules (`AuthModule`, `AiModule`, `ScormModule`)
- **Dependency Injection**: Use constructor injection with proper typing and `@Inject()` decorators
- **Provider Export**: Export services that other modules need via module `exports` array
- **Global vs Local**: Use `@Global()` sparingly, prefer explicit imports for better dependency tracking

```typescript
// ✅ Correct Module Structure
@Module({
  imports: [StudentLessonProgressModule], 
  controllers: [AiController],
  providers: [AiService, AiRepository, TokenService],
  exports: [AiService, AiRepository], // Export what others need
})
export class AiModule {}
```

### Service Layer Architecture  
- **Single Responsibility**: Each service handles one domain (e.g., `AiService` for AI operations only)
- **Repository Pattern**: Services use repositories for data access, never direct ORM calls
- **Dependency Chain**: Controller → Service → Repository → Database
- **Transaction Management**: Use database transactions for multi-table operations

```typescript
// ✅ Correct Service Pattern
@Injectable()
export class AiService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly tokenService: TokenService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {}

  async streamMessage(data: StreamChatBody): Promise<StreamResponse> {
    // Service orchestrates business logic
    await this.summaryService.summarizeThreadOnTokenThreshold(data.threadId);
    const prompt = await this.promptService.buildPrompt(data.threadId, data.content);
    return this.chatService.generateResponse(prompt);
  }
}
```

## 🛡️ Security & Authentication Patterns

### JWT Authentication Standards
- **Global Guard**: `JwtAuthGuard` applied globally, use `@Public()` decorator for exceptions
- **Multi-Strategy Auth**: Support local, Google OAuth, and Microsoft OAuth strategies  
- **Token Management**: Separate access and refresh tokens with different expiration times
- **Role-Based Access**: Use `@Roles()` decorator with `RolesGuard` for authorization

```typescript
// ✅ Correct Authentication Pattern
@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonController {
  @Public()
  @Get('public')
  getPublicLessons() {} // Public endpoint exception

  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)  
  @Post()
  createLesson(@User() user: CommonUser) {} // Protected with roles
}
```

### Data Validation & Input Handling
- **Schema Validation**: Use TypeBox schemas for all request validation
- **File Upload Security**: Validate MIME types, file sizes, and use S3 service exclusively
- **SQL Injection Prevention**: Use Drizzle ORM parameterized queries, never string concatenation
- **Environment Variables**: Access config through `ConfigService`, never `process.env` directly

```typescript
// ✅ Correct Validation Pattern  
@Post('upload')
async uploadFile(
  @Body() body: Static<typeof CreateFileSchema>,
  @UploadedFile(new ValidateMultipartPipe()) file: Express.Multer.File
) {
  // Schema validation + file validation enforced
}
```

## 🤖 AI Integration Patterns  

### OpenAI Service Integration
- **Cost Management**: Implement token counting for all AI operations using `TokenService`
- **Error Handling**: Gracefully handle API failures, rate limits, and token exhaustion
- **Streaming Responses**: Use `streamText()` for real-time AI interactions with proper cleanup
- **Context Management**: Summarize long conversations to stay within token limits

```typescript
// ✅ Correct AI Integration Pattern
async streamMessage(data: StreamChatBody, model: OpenAIModels) {
  await this.summaryService.summarizeThreadOnTokenThreshold(data.threadId);
  
  const result = streamText({
    model: openai(model),
    messages: prompt,
    maxTokens: MAX_TOKENS,
    onFinish: async (event) => {
      const tokenCount = this.tokenService.countTokens(model, event.text);
      await this.messageService.createMessages(/* save with token count */);
    },
  });
  return result;
}
```

### AI Thread Management
- **Thread Lifecycle**: Create, activate, archive, and reset threads with proper state management
- **Progress Tracking**: Link AI interactions to lesson progress and completion criteria
- **Judge Pattern**: Use AI judge service to evaluate student responses and mark lessons complete

## 📊 Database & Data Patterns

### Drizzle ORM Best Practices
- **Type Safety**: Leverage Drizzle's type system for compile-time query validation
- **Schema Organization**: Define all tables in `schema/index.ts` with proper relationships
- **Transaction Usage**: Wrap multi-table operations in transactions with proper error handling
- **Query Optimization**: Use selective field queries and proper joins to minimize data transfer

```typescript
// ✅ Correct Database Transaction Pattern
async register(userData: RegisterData) {
  return this.db.transaction(async (trx) => {
    const [newUser] = await trx.insert(users).values(userData).returning();
    await trx.insert(credentials).values({ userId: newUser.id, password: hashedPassword });
    await this.settingsService.createSettings(newUser.id, newUser.role, undefined, trx);
    
    this.eventBus.publish(new UserRegisteredEvent(newUser));
    return newUser;
  });
}
```

### Data Access Patterns  
- **Repository Layer**: Abstract database access behind repositories for testability
- **Service Composition**: Services compose multiple repositories as needed
- **Event Sourcing**: Emit domain events for cross-cutting concerns (statistics, notifications)
- **Soft Deletion**: Use `archived` fields instead of hard deletion for audit trails

## 🎯 Domain-Specific Patterns

### Learning Management (SCORM)
- **SCORM Compliance**: Use dedicated `ScormService` for all SCORM package handling
- **Progress Tracking**: Maintain detailed student progress with lesson completion states  
- **Quiz Management**: Handle attempts, cooldowns, and threshold scoring consistently
- **Content Delivery**: Route SCORM content through appropriate content delivery mechanisms

```typescript
// ✅ Correct Learning Progress Pattern
async markLessonAsCompleted({
  lessonId,
  studentId, 
  userRole,
  aiMentorLessonData,
}: MarkLessonCompleteData) {
  await this.db.transaction(async (trx) => {
    await this.updateProgress(lessonId, studentId, trx);
    await this.checkChapterCompletion(lessonId, studentId, trx);
    
    this.eventBus.publish(new LessonCompletedEvent({ lessonId, studentId }));
  });
}
```

### Payment Processing (Stripe)
- **Webhook Handling**: Process Stripe webhooks with proper signature verification
- **Idempotency**: Handle duplicate webhook deliveries gracefully
- **Error Recovery**: Implement retry logic for failed payment processing
- **Audit Trail**: Log all payment-related events for compliance and debugging

### File Management & Storage
- **S3 Integration**: Route all file operations through `S3Service` for consistency
- **MIME Validation**: Validate file types using `MimeTypeGuard` before processing
- **Size Limits**: Enforce file size limits at upload time (10MB default)
- **CDN Integration**: Use BunnyStream for video content delivery and optimization

## 🔄 Event-Driven Architecture

### Domain Events Pattern
- **Event Naming**: Use descriptive event names (`UserRegisteredEvent`, `LessonCompletedEvent`)  
- **Event Structure**: Include relevant data and metadata in event payloads
- **Event Handlers**: Create separate handlers for different cross-cutting concerns
- **Event Bus**: Use NestJS EventBus for publishing and subscribing to domain events

```typescript
// ✅ Correct Event Pattern
export class UserRegisteredEvent {
  constructor(public readonly user: User) {}
}

// In service:
this.eventBus.publish(new UserRegisteredEvent(newUser));

// Handler:
@OnEvent('UserRegisteredEvent')
async handleUserRegistered(event: UserRegisteredEvent) {
  await this.statisticsService.recordUserRegistration(event.user);
  await this.emailService.sendWelcomeEmail(event.user.email);
}
```

## 📈 Performance & Monitoring

### Caching Strategies
- **Redis Integration**: Use `CacheModule` for session and frequently-accessed data
- **Cache Invalidation**: Implement proper cache invalidation on data updates
- **Cache Keys**: Use consistent, hierarchical cache key naming patterns

### Error Handling & Monitoring
- **Sentry Integration**: Use `SentryInterceptor` for error tracking and performance monitoring
- **Custom Exceptions**: Create domain-specific exceptions that extend NestJS base exceptions
- **Structured Logging**: Include context (userId, requestId) in all log entries
- **Health Checks**: Implement comprehensive health checks for all external dependencies

```typescript
// ✅ Correct Error Handling Pattern  
export class LessonNotAssignedException extends BadRequestException {
  constructor(lessonId: string, userId: string) {
    super(`User ${userId} is not assigned to lesson ${lessonId}`);
  }
}
```

## 🧪 Testing Standards

### Unit Testing Patterns
- **Test Organization**: Co-locate tests with source code in `__tests__/` folders
- **Mock Strategy**: Mock external dependencies (database, APIs) but test business logic
- **Test Naming**: Use descriptive test names that explain the scenario and expected outcome
- **Factory Pattern**: Use test factories for creating consistent test data

### E2E Testing Patterns  
- **Test Database**: Use separate test database with proper cleanup between tests
- **Authentication Testing**: Test both authenticated and unauthenticated scenarios
- **API Contract Testing**: Validate request/response schemas and status codes
- **Test Data Management**: Use seeding and cleanup strategies for consistent test environments

## 📋 Code Quality Standards

### Critical Rules for AI Agents
- **Database Access**: ALWAYS use repository pattern or service layer, never direct ORM queries in controllers
- **Authentication**: All endpoints except health checks and public auth endpoints MUST be protected by JWT guard
- **Validation**: All request bodies MUST be validated using TypeBox schemas before processing
- **Error Handling**: Use domain-specific custom exceptions, never throw generic Error objects
- **File Operations**: All file uploads MUST go through S3 service, validate MIME types and file sizes
- **AI Integration**: Always handle OpenAI API failures gracefully, implement token counting and rate limiting
- **Environment Config**: Never hardcode configuration values, always use environment variables through config service
- **Event Emission**: Emit domain events for cross-cutting concerns (statistics, notifications, AI triggers)
- **Transaction Safety**: Wrap multi-table operations in database transactions with proper rollback handling
- **Multi-tenancy**: Respect group-based access controls and data isolation patterns

## 📝 Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| **Files** | kebab-case | `user-profile.service.ts` |
| **Classes** | PascalCase | `UserProfileService` |
| **Methods** | camelCase | `getUserProfile()` |
| **Constants** | SCREAMING_SNAKE_CASE | `USER_ROLES.ADMIN` |
| **Database Tables** | snake_case | `student_lesson_progress` |
| **API Endpoints** | kebab-case | `/api/user-profile` |
| **Event Classes** | PascalCase + Event | `UserRegisteredEvent` |
| **Schema Types** | PascalCase + Schema | `CreateUserSchema` |
| **Repository Methods** | descriptive + Entity | `findUserWithCredentials()` |

## 🔧 TypeScript-Specific Guidelines
- **Interface Definitions**: Prefer interfaces over types for object shapes, use types for unions and computed types
- **Null Handling**: Use strict null checks, explicit nullable types (`string | null`)
- **Return Types**: Always specify return types for public methods, especially async functions
- **Generic Constraints**: Use meaningful constraint names (`T extends BaseEntity`)
- **Enum Usage**: Use const enums for better performance, string enums for debugging
- **Decorator Usage**: Leverage NestJS decorators for dependency injection, validation, and guards
- **Type Guards**: Implement type guards for runtime type checking when needed

## 🚀 Development Workflow Standards

### Module Development Lifecycle
1. **Schema First**: Define TypeBox schemas and database tables before implementation
2. **Test-Driven**: Write tests alongside implementation, not as an afterthought
3. **Repository Layer**: Implement data access layer with proper abstractions
4. **Service Layer**: Build business logic that orchestrates repositories
5. **Controller Layer**: Create thin controllers that handle HTTP concerns only
6. **Integration**: Wire modules together with proper dependency injection
7. **E2E Validation**: Validate complete user journeys with comprehensive E2E tests

### Code Review Standards
- **Architecture Alignment**: Verify new code follows established architectural patterns
- **Security Review**: Check for proper authentication, validation, and error handling
- **Performance Impact**: Consider database query efficiency and caching strategies
- **Test Coverage**: Ensure adequate test coverage for new functionality
- **Documentation**: Update relevant documentation for API or architectural changes
