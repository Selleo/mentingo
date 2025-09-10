# Introduction

This document outlines the overall project architecture for Mentingo, including backend systems, shared services, and non-UI specific concerns. Its primary goal is to serve as the guiding architectural blueprint for AI-driven development, ensuring consistency and adherence to chosen patterns and technologies.

**Relationship to Frontend Architecture:**
If the project includes a significant user interface, a separate Frontend Architecture Document will detail the frontend-specific design and MUST be used in conjunction with this document. Core technology stack choices documented herein (see "Tech Stack") are definitive for the entire project, including any frontend components.

## Starter Template or Existing Project

**Existing Project Foundation:**
Mentingo is built on an **existing, mature NestJS foundation** rather than a starter template. Here's what has been identified:

**Framework**: NestJS 10.0.0 with TypeScript 5.4.5
**Architecture**: Well-established domain-driven design with modules
**Database**: Drizzle ORM with PostgreSQL, 28+ migrations showing mature evolution
**Authentication**: Multi-strategy (Local, Google OAuth, Microsoft OAuth, JWT)
**Testing**: Comprehensive Jest setup with E2E and unit test infrastructure
**Monorepo**: Established Turbo monorepo with api/web/reverse-proxy apps

**Key Architectural Patterns Already Established:**
- Module-based organization by domain (auth, courses, lessons, ai, etc.)
- Repository pattern with Drizzle ORM
- CQRS implementation with event handling
- Comprehensive validation with schemas
- Multi-tenant settings architecture
- Advanced AI integration with OpenAI

**Decision**: Document the existing mature architecture to facilitate developer onboarding and maintain architectural consistency.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-13 | 1.0 | Initial architecture documentation | Winston (Architect) |
