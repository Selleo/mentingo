# REST API Spec

Based on the existing OpenAPI schema and component analysis, here's the essential REST API structure:

```yaml
openapi: 3.0.0
info:
  title: Mentingo LMS Backend API
  version: 1.0.0
  description: Learning Management System API for course management, AI mentoring, and progress tracking
servers:
  - url: http://localhost:3001/api
    description: Local development server
  - url: https://api.mentingo.com/api
    description: Production server [TBD - TO BE CONFIRMED]

security:
  - bearerAuth: []

paths:
  # Authentication Endpoints
  /auth/register:
    post:
      tags: [Authentication]
      summary: User registration
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, firstName, lastName, password]
              properties:
                email: { type: string, format: email }
                firstName: { type: string, minLength: 1 }
                lastName: { type: string, minLength: 1 }
                password: { type: string, minLength: 8 }
      responses:
        '201':
          description: User registered successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  user: { $ref: '#/components/schemas/User' }
                  tokens: { $ref: '#/components/schemas/JWTTokens' }

  /auth/login:
    post:
      tags: [Authentication]
      summary: User login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string }
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  user: { $ref: '#/components/schemas/User' }
                  tokens: { $ref: '#/components/schemas/JWTTokens' }

  # Course Management Endpoints  
  /courses:
    get:
      tags: [Courses]
      summary: List courses with filtering
      parameters:
        - name: categoryId
          in: query
          schema: { type: string }
        - name: page
          in: query
          schema: { type: integer, minimum: 1 }
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 100 }
      responses:
        '200':
          description: Course list
          content:
            application/json:
              schema:
                type: object
                properties:
                  courses: 
                    type: array
                    items: { $ref: '#/components/schemas/Course' }
                  pagination: { $ref: '#/components/schemas/Pagination' }

    post:
      tags: [Courses]
      summary: Create new course (Content Creator/Admin only)
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateCourseRequest'
      responses:
        '201':
          description: Course created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Course'

  /courses/{courseId}/enroll:
    post:
      tags: [Courses]
      summary: Enroll student in course
      security:
        - bearerAuth: []
      parameters:
        - name: courseId
          in: path
          required: true
          schema: { type: string }
      responses:
        '201':
          description: Enrollment successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  enrolled: { type: boolean }
                  enrollmentDate: { type: string, format: date-time }

  # Learning Content Endpoints
  /lessons/{lessonId}:
    get:
      tags: [Learning]
      summary: Get lesson content and questions
      security:
        - bearerAuth: []
      parameters:
        - name: lessonId
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: Lesson content
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LessonDetail'

  /lessons/{lessonId}/complete:
    post:
      tags: [Learning]
      summary: Mark lesson as completed
      security:
        - bearerAuth: []
      parameters:
        - name: lessonId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                answers: 
                  type: array
                  items: { $ref: '#/components/schemas/QuestionAnswer' }
      responses:
        '200':
          description: Progress updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LessonProgress'

  # AI Mentoring Endpoints
  /ai/chat:
    post:
      tags: [AI Mentoring]
      summary: Send message to AI mentor
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [message, lessonId]
              properties:
                message: { type: string, minLength: 1 }
                lessonId: { type: string }
                threadId: { type: string }
      responses:
        '200':
          description: AI response
          content:
            application/json:
              schema:
                type: object
                properties:
                  response: { type: string }
                  threadId: { type: string }
                  suggestions: 
                    type: array
                    items: { type: string }

  # File Upload Endpoints
  /files/upload:
    post:
      tags: [Files]
      summary: Upload files (images, documents, SCORM packages)
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file: 
                  type: string
                  format: binary
                type:
                  type: string
                  enum: [avatar, course-content, scorm-package]
      responses:
        '201':
          description: File uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  fileId: { type: string }
                  url: { type: string }
                  metadata: { $ref: '#/components/schemas/FileMetadata' }

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id: { type: string }
        email: { type: string, format: email }
        firstName: { type: string }
        lastName: { type: string }
        role: 
          type: string
          enum: [STUDENT, CONTENT_CREATOR, ADMIN]
        avatarReference: { type: string, nullable: true }
        createdAt: { type: string, format: date-time }

    JWTTokens:
      type: object
      properties:
        accessToken: { type: string }
        refreshToken: { type: string }
        expiresIn: { type: integer }

    Course:
      type: object
      properties:
        id: { type: string }
        title: { type: string }
        description: { type: string }
        categoryId: { type: string }
        isPublished: { type: boolean }
        createdBy: { type: string }
        chaptersCount: { type: integer }
        enrolledStudents: { type: integer }

    LessonProgress:
      type: object
      properties:
        lessonId: { type: string }
        userId: { type: string }
        isCompleted: { type: boolean }
        completedAt: { type: string, format: date-time, nullable: true }
        score: { type: number, minimum: 0, maximum: 100 }
        attempts: { type: integer }

    Pagination:
      type: object
      properties:
        page: { type: integer }
        limit: { type: integer }
        total: { type: integer }
        totalPages: { type: integer }

    Error:
      type: object
      properties:
        message: { type: string }
        statusCode: { type: integer }
        error: { type: string }
        timestamp: { type: string, format: date-time }
```
