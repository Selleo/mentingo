# Data Models

Based on the comprehensive database schema, here are the core business entities in Mentingo:

## User Management Domain

**Purpose:** Handles user authentication, profiles, and role-based access control

**Key Attributes:**
- `id`: UUID - Primary identifier  
- `email`: string - Unique authentication identifier
- `firstName`, `lastName`: string - User profile information
- `avatarReference`: string - Profile image storage reference
- `role`: enum - USER_ROLES (STUDENT, CONTENT_CREATOR, ADMIN)
- `archived`: boolean - Soft deletion support
- `timestamps`: createdAt, updatedAt - Audit trail

**Relationships:**
- One-to-many with studentCourses (enrollment)
- One-to-many with studentLessonProgress (learning progress)
- One-to-many with aiMentorThreads (AI interactions)
- One-to-many with userStatistics (performance metrics)

## Course Management Domain

**Purpose:** Core learning content structure and organization

**Key Attributes:**
- Course hierarchy: `courses` → `chapters` → `lessons` → `questions`
- Content metadata: title, description, display order
- SCORM compliance: `scormFiles`, `scormMetadata` 
- Categorization: `categories` for content organization
- Publishing workflow: draft/published states

**Relationships:**
- Courses belong to categories
- Courses contain multiple chapters (ordered sequence)
- Chapters contain multiple lessons (ordered sequence)  
- Lessons contain multiple questions (quiz/assessment content)
- Many-to-many: students enrolled in courses via `studentCourses`

## Learning Progress Domain

**Purpose:** Tracks student advancement and performance through learning materials

**Key Attributes:**
- Multi-level progress: course → chapter → lesson granularity
- Quiz attempts: `quizAttempts` with scoring and completion tracking
- AI mentoring: `aiMentorStudentLessonProgress` for personalized guidance
- Statistical aggregation: `coursesSummaryStats`, `courseStudentsStats`

**Relationships:**
- Progress entities link students to content at different granularities
- AI mentor threads track personalized learning conversations
- Statistics tables provide aggregated performance insights

## AI Mentoring Domain

**Purpose:** Personalized AI-powered learning assistance and guidance

**Key Attributes:**
- `aiMentorLessons`: AI-enhanced lesson content
- `aiMentorThreads`: Conversation sessions between student and AI
- `aiMentorThreadMessages`: Individual messages in AI conversations
- `aiMentorStudentLessonProgress`: AI-tracked learning progress

**Relationships:**
- AI threads belong to specific students and lessons
- Messages form conversation history within threads
- AI progress tracking parallels traditional progress but with enhanced intelligence
