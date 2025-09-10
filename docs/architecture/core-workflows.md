# Core Workflows

Based on the backend architecture, here are the key workflows that illustrate component interactions and system behavior:

## User Authentication & Registration Workflow

```mermaid
sequenceDiagram
    participant User
    participant Web as Web App
    participant Auth as Auth Component
    participant DB as PostgreSQL
    participant Email as Email Service
    participant OAuth as OAuth Provider

    Note over User,OAuth: Multi-Strategy Authentication Flow
    
    alt Local Registration
        User->>Web: Register with email/password
        Web->>Auth: POST /auth/register
        Auth->>DB: Check email uniqueness
        Auth->>Auth: Hash password (bcryptjs)
        Auth->>DB: Create user record
        Auth->>Email: Send verification email
        Auth-->>Web: Registration success
    else OAuth Login (Google/Microsoft)
        User->>Web: Click OAuth login
        Web->>Auth: GET /auth/google or /auth/microsoft
        Auth->>OAuth: Redirect to OAuth provider
        OAuth->>User: OAuth consent screen
        User->>OAuth: Grant permission
        OAuth->>Auth: Authorization code callback
        Auth->>OAuth: Exchange code for token
        OAuth->>Auth: User profile data
        Auth->>DB: Find or create user
        Auth->>Auth: Generate JWT tokens
        Auth-->>Web: JWT tokens + user data
    end
```

## Course Enrollment & Learning Progress Workflow

```mermaid
sequenceDiagram
    participant Student
    participant API as Course API
    participant Courses as Course Component
    participant Progress as Progress Component
    participant AI as AI Component
    participant Events as Event Bus
    participant Stats as Statistics

    Student->>API: POST /courses/:id/enroll
    API->>Courses: Validate enrollment eligibility
    Courses->>DB: Create studentCourses record
    Courses->>Events: Emit CourseEnrollment event
    Events->>Progress: Initialize progress tracking
    Events->>Stats: Update enrollment statistics
    
    Note over Student,Stats: Learning Session Flow
    Student->>API: GET /lessons/:id/content
    API->>Courses: Validate lesson access
    API-->>Student: Lesson content + questions
    
    Student->>API: POST /lessons/:id/complete
    API->>Progress: Update lesson progress
    Progress->>DB: Update studentLessonProgress
    Progress->>Events: Emit LessonCompleted event
    Events->>AI: Trigger AI mentor analysis
    Events->>Stats: Update learning statistics
    
    alt AI Mentoring Triggered
        AI->>AI: Analyze learning patterns
        AI->>OpenAI: Generate personalized feedback
        OpenAI-->>AI: AI response
        AI->>DB: Store AI mentor message
        AI-->>Student: AI guidance via WebSocket
    end
```

## Payment Processing Workflow

```mermaid
sequenceDiagram
    participant User
    participant API as Payment API
    participant Stripe as Stripe Component
    participant StripeAPI as Stripe Service
    participant Courses as Course Component
    participant Events as Event Bus

    User->>API: POST /payments/create-intent
    API->>Stripe: Create payment intent
    Stripe->>StripeAPI: Create payment intent
    StripeAPI-->>Stripe: Payment intent + client_secret
    Stripe-->>API: Return payment details
    API-->>User: Client secret for frontend

    User->>User: Complete payment in frontend
    StripeAPI->>API: POST /webhooks/stripe (payment success)
    API->>Stripe: Verify webhook signature
    Stripe->>Stripe: Process payment confirmation
    Stripe->>Courses: Grant course access
    Courses->>DB: Update user permissions
    Stripe->>Events: Emit PaymentCompleted event
    Events->>Stats: Update revenue statistics
```

## AI Mentoring Conversation Workflow

```mermaid
sequenceDiagram
    participant Student
    participant API as AI API
    participant AI as AI Component
    participant OpenAI as OpenAI Service
    participant DB as Database
    participant Progress as Progress Tracker

    Student->>API: POST /ai/chat
    API->>AI: Process chat message
    AI->>DB: Retrieve conversation context
    AI->>Progress: Get learning progress context
    AI->>AI: Build conversation prompt
    AI->>OpenAI: Send chat completion request
    OpenAI-->>AI: AI response
    AI->>DB: Store conversation message
    AI->>DB: Update AI mentor progress
    AI-->>API: Formatted AI response
    API-->>Student: AI mentor message

    Note over AI,Progress: Background Analysis
    AI->>Progress: Analyze learning patterns
    AI->>AI: Generate learning insights
    AI->>DB: Store insights for future sessions
```
