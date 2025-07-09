<div align="center">
  <img src="https://github.com/Selleo/lms-core/blob/main/apps/web/app/assets/menitngo_logo dark.png?raw=true" alt"" />

# Mentingo LMS Core Project

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/) [![Node.js](https://img.shields.io/badge/Node.js-20.15.0-brightgreen.svg)](https://nodejs.org/) [![pnpm](https://img.shields.io/badge/pnpm-supported-blue.svg)](https://pnpm.io/) [![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/) [![Remix](https://img.shields.io/badge/Remix-Latest-purple.svg)](https://remix.run/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
</br>
A modern, scalable Learning Management System built with cutting-edge technologies.

[Features](#features) • [Getting Started](#getting-started) • [Development](#development) • [Contributing](#contributing)

</div>

</br>
<div align="center">

## Table of Contents

</div>

- [Overview](#overview)
  - [Apps](#apps)
  - [Packages](#packages)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
  - [Migrations](#migrations)
  - [Database Seeding](#database-seeding)
- [Development](#development)
  - [Available Services](#available-services)
- [Commands Reference](#commands-reference)
  - [Database Commands](#database-commands)
  - [HTTP Client Generation](#http-client-generation)
  - [Email Templates](#email-templates)
  - [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Legal Notice](#legal-notice)
- [About Selleo](#about-selleo)

</br>
<div align="center">

## Features

</div>

- **Course Structure**: Courses built from categories, modules and various lesson types
- **Lesson Types**: Supports text, video, presentation and quiz lessons
- **Quiz Engine**: Multiple-choice, single-choice, true/false, gap-filling, short/long text answers and image-based questions
- **Price Configuration**: Flexible setup for free and paid course access
- **Progress Tracking**: Automatic progress saving and course completion logic
- **Daily Streak Tracking**: Motivational system for tracking learning consistency
- **Statistics & Insights**: Detailed data on user engagement and learning results
- **Admin Panel**: Tools for managing users, courses, content and statistics
- **User Roles**: Separate experiences for students and administrators

</br>
<div align="center">

## Overview

</div>

### Apps

- **api**: A NestJS backend application working as API
- **web**: A Vite Remix SPA
- **reverse-proxy**: For domains and https during development

### Packages

- **email-templates**: A package for email templates
- **eslint-config**: A package for eslint configuration
- **typescript-config**: A package for typescript configuration

</br>
<div align="center">

## Getting Started

</div>

### Prerequisites

Before you begin, make sure you have:

- Node.js version 20.15.0 (stated in `.tool-versions`)
  - We recommend using [asdf](https://asdf-vm.com/) for version management
- [pnpm](https://pnpm.io/) package manager
- [Caddy](https://caddyserver.com/docs/install#homebrew-mac) v2.8.4
- Docker and Docker Compose

### Installation

Install project dependencies:

```bash
pnpm install
```

Configure Caddy (first-time setup only):

```bash
cd ./apps/reverse-proxy
caddy run
# After running caddy just terminate the process with Ctrl+C
```

> [!IMPORTANT]
> First run has to be run by hand to configure caddy. Later on it will automatically
> start with the app start script.

### Environment Setup

Configure environment variables for both applications:

```bash
cd apps/api
cp .env.example .env
```

```bash
cd apps/web
cp .env.example .env
```

</br>
<div align="center">

## Database Setup

</div>

### Migrations

> [!NOTE]
> In project root.

1. Start the database:

```bash
docker-compose up -d
```

2. Run migrations:

```bash
pnpm db:migrate
```

### Database Seeding

Populate the database with initial data:

```bash
pnpm db:seed
```

### Default User Accounts

After running the database seeding **AFTER** renaming the `teacher` role to `content creator`, the following default accounts are available:

| Role            | Email                       | Password |
| --------------- | --------------------------- | -------- |
| Student         | student@example.com         | password |
| Student         | student2@example.com        | password |
| Content Creator | contentcreator@example.com  | password |
| Content Creator | contentcreator2@example.com | password |
| Admin           | admin@example.com           | password |

> [!NOTE]
> These accounts are created during the seeding process and are intended for development and testing purposes only.

</br>
<div align="center">

## Development

</div>

To start all applications in development mode:

```bash
pnpm dev
```

### Available Services

After starting the development environment, you can access:

| Service | URL                           | Description             |
| ------- | ----------------------------- | ----------------------- |
| Web App | https://app.lms.localhost     | Frontend application    |
| API     | https://app.lms.localhost/api | Backend API url         |
| Swagger | https://api.lms.localhost/api | API documentation       |
| Mailhog | https://mailbox.lms.localhost | Email testing interface |

</br>
<div align="center">

## Commands Reference

</div>

### Formatting

- Format all files with Prettier
  ```bash
  pnpm format
  ```
- Check if all files are formatted with Prettier
  ```bash
  pnpm format:check
  ```
- Lint all files in the web app with ESLint
  ```bash
  pnpm lint-tsc-web
  ```
- Lint all files in the api app with ESLint
  ```bash
  pnpm lint-tsc-api
  ```
- Fix linting errors in the web app
  ```bash
  pnpm lint-tsc-web --fix
  ```
- Fix linting errors in the api app
  ```bash
  pnpm lint-tsc-api --fix
  ```

### Database Commands

- Generate new migration:
  ```bash
  pnpm db:generate
  ```

> [!IMPORTANT]
> After generating a migration:
>
> 1. Change its name to something descriptive that explains what it does
> 2. Make sure to update the migration name in `apps/api/src/storage/migrations/meta/_journal.json` under the `tag` key

- Run migrations:
  ```bash
  pnpm db:migrate
  ```

### HTTP Client Generation

- Generate TypeScript API client based on Swagger specification:
  ```bash
  pnpm generate:client
  ```

### Email Templates

- Build email templates:
  ```bash
  cd packages/email-templates
  pnpm build
  ```

Email templates are automatically built when starting the development server. To test emails, check the Mailhog interface at [mailbox.lms.localhost](https://mailbox.lms.localhost).

### Testing

- Frontend tests:

  - Unit
    ```bash
    pnpm test:web
    ```
  - E2E

    ```bash
    bash test-e2e.sh
    ```

    or

    ```bash
    chmod +x test-e2e.sh
    ./test-e2e.sh
    ```

- Backend tests:
  ```bash
  pnpm test:api        # Unit tests
  pnpm test:api:e2e    # E2E tests
  ```

</br>
<div align="center">

## Project Structure

</div>

```
lms-core
├── apps
│   ├── api
│   │   ├── src
│   │   └── test
│   ├── reverse-proxy
│   └── web
│       ├── app
│       │   ├── api
│       │   ├── assets
│       │   ├── components
│       │   └── modules
│       └── e2e
└── packages
    ├── email-templates
    ├── eslint-config
    └── typescript-config
```

</br>
<div align="center">

## Contributing

</div>

We welcome contributions to LMS Core! Please check our Contributing Guide (coming soon) for guidelines about how to proceed.

### 📚 Naming Conventions: Branches, Commits, and Pull Requests

To ensure consistency and clarity across our development workflow, we follow the naming conventions outlined below.

---

#### 🔀 Branch Naming

Each branch name should follow this pattern:

`[initials]_[type]_[module]_[ticket]_[short_description]`

**Components:**

- `initials` – First letter of the author's first and last name, in lowercase (e.g., `jd` for _John Doe_)
- `type` – Type of change:
  - `feat` – New feature
  - `fix` – Bug fix
  - `chore` – Maintenance or build-related tasks
  - `refactor` – Code refactoring without functional changes
- `module` – Relevant module or system (e.g. `lms`)
- `ticket` – Ticket or issue number (e.g. `459`)
- `short_description` _(optional)_ – Brief description in `snake_case`

**Example:**

```
jd_feat_lms_459_implement_sso
```

---

#### ✅ Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format:**

```
<prefix>: description of the change
```

**Examples:**

```
feat: implement SSO authentication
fix: resolve token expiration issue
```

---

#### 📦 Pull Requests

Pull Requests should:

- Use conventional title format:

```
feat(LMS-459): Implement SSO authentication
fix(LMS-482): Resolve token expiration issue
refactor(LMS-501): Simplify chart rendering logic
```

- Follow the project's PR template and fill out all required sections
- Provide a brief description of the change and link to the related ticket
- Include screenshots, test results, or instructions if applicable

---

## Legal notice

This project was generated using [Selleo LMS](https://github.com/Selleo/lms-core) which is licensed under the MIT license.

## Partners

![selleo](https://raw.githubusercontent.com/Selleo/selleo-resources/master/public/github_footer.png)

Ready to scale your eLearning platform? [Selleo](https://selleo.com/lms-software-development) will help with product-minded dev teams who are here to make it happen.
