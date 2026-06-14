# Development Setup

This guide covers local prerequisites, installation, seeded development accounts, and service URLs for running Mentingo locally.

## Prerequisites

Before you begin, make sure you have:

- Node.js version 20.15.0, as stated in `.tool-versions`.
  - We recommend using [asdf](https://asdf-vm.com/) for version management.
- [pnpm](https://pnpm.io/) package manager.
- [Caddy](https://caddyserver.com/docs/install#homebrew-mac) v2.8.4.
- Docker and Docker Compose.

## Installation

Run the automated setup script.

On macOS/Linux:

```bash
pnpm setup:unix
```

On Windows:

```bash
pnpm setup:win
```

The setup script will automatically:

- Verify all prerequisites and tool versions.
- Configure Caddy for HTTPS development.
- Install project dependencies.
- Build shared packages.
- Set up environment files (`.env`).
- Start Docker containers.
- Run database migrations.
- Seed the database.

> [!NOTE]
> On Linux, Caddy needs permission to bind to port 443. The script will automatically handle this, but you may be prompted for your sudo password.

## Default User Accounts

After setup completes, the following default accounts are available:

| Role            | Email                              | Password |
| --------------- | ---------------------------------- | -------- |
| Admin           | admin+tenant1@example.com          | password |
| Student         | student+tenant1@example.com        | password |
| Content Creator | contentcreator+tenant1@example.com | password |

> [!NOTE]
> The setup script seeds the default multi-tenant development environment. The primary tenant uses the accounts above.

Default tenant hosts:

- `https://tenant1.lms.localhost`
- `https://tenant2.lms.localhost`
- `https://tenant3.lms.localhost`

> [!TIP]
> If you open one of the other seeded hosts, log in with `admin+tenant<number>@example.com` and the same password.

> [!NOTE]
> All accounts are intended for development and testing purposes only.

## Running Development Servers

To start all applications in development mode:

```bash
pnpm dev
```

## Available Services

After starting the development environment, you can access:

| Service | URL                               | Description             |
| ------- | --------------------------------- | ----------------------- |
| Web App | https://tenant1.lms.localhost     | Frontend application    |
| API     | https://tenant1.lms.localhost/api | Backend API URL         |
| Swagger | https://tenant1.lms.localhost/api | API documentation       |
| Mailhog | https://mailbox.lms.localhost     | Email testing interface |

## Commands Reference

### Formatting

- Format all files with Prettier:

  ```bash
  pnpm format
  ```

- Check if all files are formatted with Prettier:

  ```bash
  pnpm format:check
  ```

- Lint all files in the web app with ESLint:

  ```bash
  pnpm lint-tsc-web
  ```

- Lint all files in the API app with ESLint:

  ```bash
  pnpm lint-tsc-api
  ```

- Fix linting errors in the web app:

  ```bash
  pnpm lint-tsc-web --fix
  ```

- Fix linting errors in the API app:

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
> 1. Change its name to something descriptive that explains what it does.
> 2. Make sure to update the migration name in `apps/api/src/storage/migrations/meta/_journal.json` under the `tag` key.

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

- Frontend unit tests:

  ```bash
  pnpm test:web
  ```

- Frontend E2E tests:

  ```bash
  bash test-e2e.sh
  ```

  or:

  ```bash
  chmod +x test-e2e.sh
  ./test-e2e.sh
  ```

- Backend tests:

  ```bash
  pnpm test:api        # Unit tests
  pnpm test:api:e2e    # E2E tests
  ```

- Performance tests:

  ```bash
  pnpm perf:load              # Load test
  pnpm perf:stress            # Stress test
  pnpm perf:spike             # Spike test
  pnpm perf:load:dashboard    # Load test with live dashboard
  ```

> [!NOTE]
> Performance tests require [k6](https://k6.io/docs/getting-started/installation/) to be installed globally and proper configuration. See [packages/performance-tests/README.md](../packages/performance-tests/README.md) for detailed setup and usage instructions.

## Project Structure

```text
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
