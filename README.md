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

- [Mentingo LMS Core Project](#mentingo-lms-core-project)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
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
    - [Default User Accounts](#default-user-accounts)
  - [Development](#development)
    - [Available Services](#available-services)
  - [Commands Reference](#commands-reference)
    - [Formatting](#formatting)
    - [Database Commands](#database-commands)
    - [HTTP Client Generation](#http-client-generation)
    - [Email Templates](#email-templates)
    - [Testing](#testing)
  - [Project Structure](#project-structure)
  - [Contributing](CONTRIBUTING.md)
  - [Deployment](#deployment)
  - [Legal notice](#legal-notice)
  - [Partners](#partners)

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
- **performance-tests**: K6 performance testing suite
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

Run the automated setup script:

**On macOS/Linux:**

```bash
pnpm setup:unix
```

**On Windows:**

```bash
pnpm setup:win
```

The setup script will automatically:

- ✓ Verify all prerequisites and tool versions
- ✓ Configure Caddy for HTTPS development
- ✓ Install project dependencies
- ✓ Build shared packages
- ✓ Set up environment files (.env)
- ✓ Start Docker containers
- ✓ Run database migrations
- ✓ Seed the database with test data

> [!NOTE]
> On Linux, Caddy needs permission to bind to port 443. The script will automatically handle this, but you may be prompted for your sudo password.

### Default User Accounts

After setup completes, the following default accounts are available:

| Role            | Email                      | Password |
| --------------- | -------------------------- | -------- |
| Admin           | admin@example.com          | password |
| Student         | user@example.com           | password |
| Content Creator | contentcreator@example.com | password |

> [!NOTE]
> The setup script creates a minimal production-like environment with only these three essential accounts.

> [!TIP]
> If you need a populated environment with sample courses, lessons, and additional test users for development, you can run the development seed instead:
>
> ```bash
> pnpm db:seed
> ```
>
> This will create accounts:
>
> | Role            | Email                       | Password |
> | --------------- | --------------------------- | -------- |
> | Student         | student@example.com         | password |
> | Student         | student2@example.com        | password |
> | Content Creator | contentcreator@example.com  | password |
> | Content Creator | contentcreator2@example.com | password |
> | Admin           | admin@example.com           | password |

> [!NOTE]
> All accounts are intended for development and testing purposes only.

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

- Performance tests (requires [k6](https://k6.io/docs/getting-started/installation/)):

  ```bash
  pnpm perf:load              # Load test
  pnpm perf:stress            # Stress test
  pnpm perf:spike             # Spike test
  pnpm perf:load:dashboard    # Load test with live dashboard
  ```

  > [!NOTE]
  > Performance tests require k6 to be installed globally and proper configuration. See [packages/performance-tests/README.md](packages/performance-tests/README.md) for detailed setup and usage instructions.

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
    ├── performance-tests
    ├── shared
    └── typescript-config
```

</br>
<div align="center">

## Contributing

</div>

We welcome contributions to Mentingo! Please check our [Contributing Guide](CONTRIBUTING.md) for guidelines about how to proceed.

---

## Deployment

See [Deployment Guide](docs/deployment.md) for more details.

## Legal notice

This project was generated using [Selleo LMS](https://github.com/Selleo/lms-core) which is licensed under the MIT license.

## Partners

![selleo](https://raw.githubusercontent.com/Selleo/selleo-resources/master/public/github_footer.png)

Ready to scale your eLearning platform? [Selleo](https://selleo.com/lms-software-development) will help with product-minded dev teams who are here to make it happen.
