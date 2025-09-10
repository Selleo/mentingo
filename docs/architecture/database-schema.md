# Database Schema

**Database Type:** PostgreSQL with Drizzle ORM
**Schema Management:** Migration-based with 28+ migrations showing mature evolution
**Key Features:** UUID primary keys, comprehensive timestamps, soft deletion support, referential integrity

## Core Entity Tables

```sql
-- Users & Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    avatar_reference VARCHAR(200),
    role TEXT NOT NULL DEFAULT 'STUDENT', -- STUDENT | CONTENT_CREATOR | ADMIN
    archived BOOLEAN DEFAULT FALSE
);

-- User credentials for local authentication
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    password_hash TEXT NOT NULL
);

-- Password reset tokens
CREATE TABLE reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE
);

-- Account creation tokens
CREATE TABLE create_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_count INTEGER DEFAULT 0
);
```

## Content Management Tables

```sql
-- Course categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    display_order INTEGER,
    archived BOOLEAN DEFAULT FALSE
);

-- Courses
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    title VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    thumbnail_s3_key VARCHAR(200),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    price_in_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR DEFAULT 'usd',
    chapter_count INTEGER NOT NULL DEFAULT 0,
    is_scorm BOOLEAN NOT NULL DEFAULT FALSE,
    author_id UUID REFERENCES users(id) NOT NULL,
    category_id UUID REFERENCES categories(id) NOT NULL
);

-- Course chapters (hierarchical content organization)
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    display_order INTEGER,
    archived BOOLEAN DEFAULT FALSE
);

-- Individual lessons within chapters
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(20) NOT NULL, -- video | quiz | scorm | external
    title VARCHAR(100) NOT NULL,
    description TEXT,
    threshold_score INTEGER, -- Minimum score to pass
    attempts_limit INTEGER, -- Maximum quiz attempts
    quiz_cooldown_in_hours INTEGER, -- Cooldown between attempts
    display_order INTEGER,
    file_s3_key VARCHAR(200), -- Content file storage
    file_type VARCHAR(20), -- MIME type
    is_external BOOLEAN DEFAULT FALSE
);
```

## Assessment & Quiz Tables

```sql
-- Questions within lessons
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(20) NOT NULL, -- multiple-choice | true-false | fill-blank | scale
    title TEXT NOT NULL,
    description TEXT,
    display_order INTEGER,
    points INTEGER DEFAULT 1,
    archived BOOLEAN DEFAULT FALSE
);

-- Answer options for multiple choice questions
CREATE TABLE question_answer_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER
);

-- Student quiz attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    lesson_id UUID REFERENCES lessons(id) NOT NULL,
    score INTEGER, -- Percentage score
    is_passed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, lesson_id, created_at) -- Track multiple attempts
);

-- Individual question answers
CREATE TABLE student_question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    quiz_attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) NOT NULL,
    answer_text TEXT,
    selected_option_id UUID REFERENCES question_answer_options(id),
    points_earned INTEGER DEFAULT 0,
    is_correct BOOLEAN DEFAULT FALSE
);
```

## Learning Progress Tables

```sql
-- Course enrollment
CREATE TABLE student_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    course_id UUID REFERENCES courses(id) NOT NULL,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, course_id)
);

-- Chapter-level progress tracking
CREATE TABLE student_chapter_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    chapter_id UUID REFERENCES chapters(id) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, chapter_id)
);

-- Lesson-level progress tracking
CREATE TABLE student_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    lesson_id UUID REFERENCES lessons(id) NOT NULL,
    chapter_id UUID REFERENCES chapters(id) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    is_started BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    is_quiz_passed BOOLEAN DEFAULT FALSE,
    
    UNIQUE(user_id, lesson_id)
);
```

## AI Mentoring Tables

```sql
-- AI-enhanced lessons
CREATE TABLE ai_mentor_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lesson_id UUID REFERENCES lessons(id) NOT NULL,
    ai_prompt TEXT,
    learning_objectives TEXT,
    difficulty_level VARCHAR(20),
    
    UNIQUE(lesson_id)
);

-- AI conversation threads
CREATE TABLE ai_mentor_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    lesson_id UUID REFERENCES lessons(id) NOT NULL,
    thread_title VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE
);

-- Individual AI conversation messages
CREATE TABLE ai_mentor_thread_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    thread_id UUID REFERENCES ai_mentor_threads(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) NOT NULL, -- user | assistant | system
    content TEXT NOT NULL,
    tokens_used INTEGER,
    model_version VARCHAR(50)
);

-- AI-tracked learning progress
CREATE TABLE ai_mentor_student_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    lesson_id UUID REFERENCES lessons(id) NOT NULL,
    understanding_level INTEGER, -- 1-10 scale
    engagement_score INTEGER, -- AI-calculated engagement
    learning_insights TEXT, -- AI-generated insights
    recommended_actions TEXT -- AI recommendations
);
```

## Supporting Tables

```sql
-- SCORM package metadata
CREATE TABLE scorm_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    course_id UUID REFERENCES courses(id) NOT NULL,
    package_name VARCHAR(200),
    version VARCHAR(50),
    metadata JSONB -- SCORM package metadata
);

-- SCORM file storage references
CREATE TABLE scorm_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata_id UUID REFERENCES scorm_metadata(id) ON DELETE CASCADE NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER
);

-- User groups for batch management
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name VARCHAR(100) NOT NULL,
    characteristic TEXT, -- Group description
    archived BOOLEAN DEFAULT FALSE
);

-- Group membership
CREATE TABLE group_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    UNIQUE(group_id, user_id)
);

-- Global platform settings (multi-tenant support)
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_name VARCHAR(200),
    company_email VARCHAR(200),
    platform_logo_s3_key VARCHAR(200),
    unregistered_user_courses_accessibility BOOLEAN DEFAULT TRUE,
    enforce_sso BOOLEAN DEFAULT FALSE,
    
    -- Ensure single settings record
    CONSTRAINT single_settings CHECK (id = gen_random_uuid())
);
```

## Statistics and Analytics Tables

```sql
-- User performance statistics
CREATE TABLE user_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) NOT NULL,
    courses_enrolled INTEGER DEFAULT 0,
    courses_completed INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    total_study_time_minutes INTEGER DEFAULT 0,
    average_quiz_score DECIMAL(5,2),
    
    UNIQUE(user_id)
);

-- Course summary statistics
CREATE TABLE courses_summary_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    course_id UUID REFERENCES courses(id) NOT NULL,
    total_enrollments INTEGER DEFAULT 0,
    completed_enrollments INTEGER DEFAULT 0,
    average_completion_time_hours DECIMAL(8,2),
    average_course_rating DECIMAL(3,2),
    
    UNIQUE(course_id)
);

-- Detailed course-student statistics
CREATE TABLE course_students_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    course_id UUID REFERENCES courses(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    enrollment_date TIMESTAMP WITH TIME ZONE,
    completion_date TIMESTAMP WITH TIME ZONE,
    study_time_minutes INTEGER DEFAULT 0,
    quiz_attempts INTEGER DEFAULT 0,
    average_quiz_score DECIMAL(5,2),
    
    UNIQUE(course_id, user_id)
);
```

## Key Indexes and Constraints

```sql
-- Performance indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE archived = FALSE;

CREATE INDEX idx_courses_published ON courses(is_published) WHERE archived = FALSE;
CREATE INDEX idx_courses_category ON courses(category_id);
CREATE INDEX idx_courses_author ON courses(author_id);

CREATE INDEX idx_lessons_chapter ON lessons(chapter_id);
CREATE INDEX idx_lessons_type ON lessons(type);

CREATE INDEX idx_student_progress_user ON student_lesson_progress(user_id);
CREATE INDEX idx_student_progress_lesson ON student_lesson_progress(lesson_id);
CREATE INDEX idx_student_progress_completed ON student_lesson_progress(is_completed);

CREATE INDEX idx_ai_threads_user_lesson ON ai_mentor_threads(user_id, lesson_id);
CREATE INDEX idx_ai_messages_thread ON ai_mentor_thread_messages(thread_id);

-- Ensure referential integrity
ALTER TABLE courses ADD CONSTRAINT fk_courses_author 
    FOREIGN KEY (author_id) REFERENCES users(id);
ALTER TABLE courses ADD CONSTRAINT fk_courses_category 
    FOREIGN KEY (category_id) REFERENCES categories(id);
```
