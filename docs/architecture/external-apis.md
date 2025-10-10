# External APIs

Based on the backend codebase analysis, here are the external API integrations that new backend developers need to understand:

## OpenAI API

- **Purpose:** Core AI mentoring functionality, conversation management, and intelligent learning assistance
- **Documentation:** https://platform.openai.com/docs/api-reference
- **Base URL(s):** https://api.openai.com/v1/
- **Authentication:** Bearer token via API key (stored in environment variables)
- **Rate Limits:** [TBD - TO BE CONFIRMED - depends on OpenAI plan]

**Key Endpoints Used:**
- `POST /chat/completions` - AI conversation responses for mentoring
- `POST /embeddings` - Text embeddings for content analysis (if used)

**Integration Notes:** 
- Uses OpenAI SDK 5.8.2 with AI SDK 4.3.17 wrapper
- Token counting via tiktoken library
- Conversation threading stored locally in aiMentorThreads table
- Error handling for API failures and rate limiting required

## Stripe API

- **Purpose:** Payment processing for course purchases and subscription management
- **Documentation:** https://stripe.com/docs/api
- **Base URL(s):** https://api.stripe.com/v1/
- **Authentication:** Secret key authentication (environment-specific keys)
- **Rate Limits:** 100 requests per second in live mode

**Key Endpoints Used:**
- `POST /payment_intents` - Create payment intents for course purchases
- `POST /webhook_endpoints` - Webhook handling for payment confirmations
- `GET /customers` - Customer management for user accounts

**Integration Notes:**
- Uses @golevelup/nestjs-stripe 0.8.2 for NestJS integration
- Webhook signature verification for security
- Payment intent workflow for secure transactions
- Customer creation linked to user registration

## Google OAuth 2.0 API

- **Purpose:** Social authentication for user registration and login
- **Documentation:** https://developers.google.com/identity/protocols/oauth2
- **Base URL(s):** https://accounts.google.com/oauth/authorize, https://oauth2.googleapis.com/token
- **Authentication:** OAuth 2.0 flow with client credentials
- **Rate Limits:** 10,000 requests per minute per project

**Key Endpoints Used:**
- `GET /oauth/authorize` - Initiate OAuth flow
- `POST /token` - Exchange authorization code for access token
- `GET /userinfo` - Retrieve user profile information

**Integration Notes:**
- Implemented via passport-google-oauth20 strategy
- Automatic user creation/linking on successful authentication
- Profile data mapping to internal user schema

## Microsoft OAuth 2.0 API

- **Purpose:** Enterprise SSO integration for organizational users
- **Documentation:** https://docs.microsoft.com/en-us/azure/active-directory/develop/
- **Base URL(s):** https://login.microsoftonline.com/
- **Authentication:** OAuth 2.0 with Microsoft tenant configuration
- **Rate Limits:** [TBD - TO BE CONFIRMED - tenant-specific]

**Key Endpoints Used:**
- `GET /oauth2/v2.0/authorize` - Initiate Microsoft OAuth flow  
- `POST /oauth2/v2.0/token` - Token exchange
- `GET /oidc/userinfo` - User profile retrieval

**Integration Notes:**
- Uses passport-microsoft 2.1.0 strategy
- Supports both personal and work/school accounts
- Tenant-specific configuration for enterprise deployments

## AWS S3 API

- **Purpose:** File storage for course content, SCORM packages, user avatars, and platform assets
- **Documentation:** https://docs.aws.amazon.com/s3/latest/API/
- **Base URL(s):** https://s3.[region].amazonaws.com/
- **Authentication:** AWS SDK with access key/secret key or IAM roles
- **Rate Limits:** 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per bucket

**Key Endpoints Used:**
- `PUT /bucket/key` - File uploads for content and media
- `GET /bucket/key` - File retrieval with presigned URLs
- `DELETE /bucket/key` - File cleanup operations

**Integration Notes:**
- Uses @aws-sdk/client-s3 3.658.1 with presigned URL generation
- Organized storage structure for different content types
- SCORM package extraction and processing
- Secure access via presigned URLs for user content

## AWS SES API

- **Purpose:** Transactional email delivery for authentication, notifications, and system communications
- **Documentation:** https://docs.aws.amazon.com/ses/latest/APIReference/
- **Base URL(s):** https://email.[region].amazonaws.com/
- **Authentication:** AWS SDK authentication (same as S3)
- **Rate Limits:** 200 emails per 24-hour period (sandbox), higher limits in production

**Key Endpoints Used:**
- `POST /` - Send email via SendEmail operation
- `POST /` - Send templated emails via SendTemplatedEmail

**Integration Notes:**
- Email adapter factory pattern supports multiple providers (SES, SMTP, local)
- Template-based email system via @repo/email-templates workspace package  
- Bounce and complaint handling for delivery reliability
- Environment-specific sender verification
