# PR Preview Deployment Guide

A comprehensive guide for setting up and managing automated PR preview environments using Uncloud.

## Table of Contents

- [PR Preview Deployment Guide](#pr-preview-deployment-guide)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Quick Reference](#quick-reference)
    - [Required Secrets](#required-secrets)
    - [Required Variables](#required-variables)
    - [Generated Resources](#generated-resources)
    - [Template Variables](#template-variables)
    - [Key Assumptions](#key-assumptions)
  - [Setup Guide](#setup-guide)
    - [Prerequisites](#prerequisites)
    - [Step 1: Prepare the Host Machine](#step-1-prepare-the-host-machine)
    - [Step 2: Configure GitHub Repository](#step-2-configure-github-repository)
    - [Step 3: Create Docker Compose Template](#step-3-create-docker-compose-template)
    - [Step 4: Create GitHub Actions Workflow](#step-4-create-github-actions-workflow)
  - [How It Works](#how-it-works)
    - [Deployment Flow](#deployment-flow)
    - [Cleanup Flow](#cleanup-flow)
    - [Domain Resolution](#domain-resolution)
    - [Service Isolation](#service-isolation)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
    - [Debugging Commands](#debugging-commands)
  - [Best Practices](#best-practices)

## Overview

This project uses **Uncloud** for automated PR preview deployments. When a pull request is opened or updated, the system automatically:

- Deploys an isolated stack with all required services (API, Web, Database, Redis, Minio, Mailhog)
- Runs database migrations and seeds test data
- Exposes the preview via unique HTTPS subdomains
- Posts preview URLs and test credentials as a PR comment
- Cleans up all resources when the PR is closed

## Quick Reference

### Required Secrets

Configure these in GitHub repository settings under **Settings -> Secrets and variables -> Actions -> Repository secrets**:

| Secret Name       | Description                           | Example Format                      |
| ----------------- | ------------------------------------- | ----------------------------------- |
| `UNCLOUD_CONNECT` | SSH connection string to Uncloud host | `user@host.example.com`             |
| `UNCLOUD_SSH_KEY` | Private SSH key for authentication    | `-----BEGIN EC PRIVATE KEY-----...` |

### Required Variables

Configure these in GitHub repository settings under **Settings -> Secrets and variables -> Actions -> Repository variables**:

| Variable Name            | Description                          | Example               |
| ------------------------ | ------------------------------------ | --------------------- |
| `UNCLOUD_PREVIEW_DOMAIN` | Base domain for preview environments | `preview.example.com` |

### Generated Resources

For each PR, the system creates such services:

- `pr-${PR_ID}.${UNCLOUD_PREVIEW_DOMAIN}` - Web application
- `api-pr-${PR_ID}.${UNCLOUD_PREVIEW_DOMAIN}` - API backend
- `mailhog-pr-${PR_ID}.${UNCLOUD_PREVIEW_DOMAIN}` - Email testing interface

### Template Variables

The `docker-compose.preview.tpl.yml` template is _docker-compose-like_ file used by Uncloud ([more info about this format](https://uncloud.run/docs/compose-file-reference/support-matrix)). It uses these variables (substituted via `envsubst`):

| Variable                    | Purpose                       |
| --------------------------- | ----------------------------- |
| `${PR_ID}`                  | Unique identifier for PR      |
| `${VERSION_TAG}`            | Image tag based on git commit |
| `${PREVIEW_WEB_DOMAIN}`     | Web application domain        |
| `${PREVIEW_API_DOMAIN}`     | API backend domain            |
| `${PREVIEW_MAILHOG_DOMAIN}` | Mailhog interface domain      |

...and all environment variables needed by the services to run.

> [!NOTE]
> These variables are for **orchestration** of the preview environment. Application-specific environment variables (e.g., OpenAI API keys, Stripe keys) are set inside the container configuration but are typically left empty or with default values for preview environments.

> [!IMPORTANT]
> All volumes and services are located on the same level of the stack on the target machine, that's why we HAVE TO use some specific naming convention for them. In this case we use `${PR_ID}` value to make them unique.

### Key Assumptions

- **Wildcard DNS**: `*.${UNCLOUD_PREVIEW_DOMAIN}` points to the Uncloud host machine
- **Host Routing**: Uncloud uses the `x-ports` notation to map domains to container ports
- **Build Cache**: GitHub Actions tries to cache Docker layers for the services
- **Secrets Management**: Sensitive values are generated per-PR or left empty for preview environments
- **Database Persistence**: Each PR has isolated database volume that persists across deployments until PR closure

> [!IMPORTANT]
> Make sure you understand the difference between `x-ports` and `ports` fields.
> `x-ports` is used for routing requests to the container ports, while `ports` is used for exposing the container ports from the host machine.
> So it's common to use `ports` by default but in this case we use `x-ports` instead, but `ports` ONLY to expose the container ports from the host machine.

## Setup Guide

### Prerequisites

Before setting up PR preview deployments, ensure you have the following:

- SSH access to the host machine
- A Linux host machine with Uncloud CLI installed (see [Uncloud CLI installation guide](https://uncloud.run/docs/getting-started/install-cli))
  - This installation also try to install Docker, Caddy and other dependencies, but if not, you might need to install them manually
  - It's recommended to use `--no-dns` flag to avoid creating DNS records in the Uncloud's registry
- Uncloud CLI installed on the some client machine, the same way as on the host machine (except we can omit docker, caddy and dependencies installation)
  - At this moment Uncloud host cannot to initialize itself, that's why we need some client machine for that purpose
- A domain with wildcard DNS configured
- GitHub repository with Actions enabled

### Step 1: Prepare the Host Machine

**1.1 Install Uncloud CLI**

```bash
curl -fsS https://get.uncloud.run/install.sh | sh
uc --version
```

**1.2 Initialize Uncloud**

Connect to the other machine and setup ssh connection to the host machine (see [Uncloud machine initialization guide](https://uncloud.run/docs/cli-reference/uc_machine_init)). Prepared SSH key will be used as `UNCLOUD_SSH_KEY` secret in the GitHub repository.

```bash
uc machine init root@host.example.com --no-dns
```

This address will be used as `UNCLOUD_CONNECT` secret in the GitHub repository.

**1.4 Configure DNS**

Set up wildcard DNS for your preview domain:

```
*.preview.example.com -> A record -> Your host IP
```

### Step 2: Configure GitHub Repository

**2.1 Add Repository Secrets**

Navigate to **Settings -> Secrets and variables -> Actions -> Repository secrets** and add:

- `UNCLOUD_CONNECT`: The connection string from Step 1.2 (format: `user@host.example.com`)
- `UNCLOUD_SSH_KEY`: The private SSH key from Step 1.2

**2.2 Add Repository Variables**

Navigate to **Settings -> Secrets and variables -> Actions -> Repository variables** and add:

- `UNCLOUD_PREVIEW_DOMAIN`: Your preview domain (e.g., `preview.example.com`)

### Step 3: Create Docker Compose Template

Create a `docker-compose.preview.tpl.yml` file with template variables to reproduce compose file per PR:

**Key Guidelines:**

1. **Service Naming**: Use `service-name-preview-pr-${PR_ID}` pattern for isolation
2. **Volume Naming**: Use `volume-name-preview-pr-${PR_ID}-data` pattern
3. **Domain Routing**: Use `x-ports` notation for Uncloud:
   ```yaml
   x-ports:
     - ${DOMAIN_VARIABLE}:8080/https # e.g - some-preview-domain.example.com:8080/https
   ```
4. **Build Context**: Use current directory (`.`) as context since GitHub Actions checks out the repo
5. **Cache Configuration**: Enable GitHub Actions cache for faster builds:
   ```yaml
   cache_from:
     - type=gha,scope=service-preview-pr-${PR_ID}
   cache_to:
     - type=gha,mode=max,scope=service-preview-pr-${PR_ID}
   ```

**Example Structure:**

```yaml
services:
  api-preview-pr-${PR_ID}:
    build:
      context: .
      dockerfile: api.Dockerfile
      cache_from:
        - type=gha,scope=api-preview-pr-${PR_ID}
      cache_to:
        - type=gha,mode=max,scope=api-preview-pr-${PR_ID}
    image: api-preview-pr-${PR_ID}:${VERSION_TAG}
    environment:
      DATABASE_URL: "postgresql://user:${POSTGRES_PASSWORD}@db-preview-pr-${PR_ID}:5432/dbname"
      # Other environment variables
    x-ports:
      - ${PREVIEW_API_DOMAIN}:3000/https
    depends_on:
      db-preview-pr-${PR_ID}:
        condition: service_healthy

volumes:
  db-preview-pr-${PR_ID}-data:
    driver: local
```

### Step 4: Create GitHub Actions Workflow

Create `.github/workflows/deploy-pr-preview.yml`:

**Key Components:**

**4.1 Trigger Configuration**

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]
    paths:
      - apps/** # any changes in the apps directory will trigger the deployment
      - .github/workflows/deploy-pr-preview.yml # this file
      - docker-compose.preview.tpl.yml
```

**4.2 Deployment Job**

```yaml
jobs:
  deploy-pr-preview:
    if: ${{ github.event_name == 'pull_request' && github.event.action != 'closed' }}
    steps:
      # 1. Install Uncloud CLI
      # 2. Setup SSH connection
      # 3. Render template e.g. with envsubst
      # 4. Deploy stack with `uc deploy`
      # 5. Run some scripts to setup the stack (e.g. migrations/seeds)
      # 6. Post initialization scripts (e.g. comment on PR with preview URLs)
```

**4.3 Cleanup Job**

```yaml
jobs:
  cleanup-pr-preview:
    if: ${{ github.event_name == 'pull_request' && github.event.action == 'closed' }}
    steps:
      # 1. Parse services and volumes from rendered template (e.g. with envsubst)
      # 2. Remove services with `uc rm`
      # 3. Remove volumes with `uc volume rm`
```

**4.4 Template Rendering**

For example, use `envsubst` to substitute variables:

```bash
export PR_ID VERSION_TAG PREVIEW_WEB_DOMAIN # ... etc
envsubst < "docker-compose.preview.tpl.yml" > "docker-compose.pr.yml"
```

**4.5 Deployment Command**

```bash
uc --connect "ssh+cli://${UNCLOUD_CONNECT}" deploy -f docker-compose.pr.yml -y
```

> [!TIP] > `ssh+cli://` it's the most bulletproof way to connect to the Uncloud host.

## How It Works

### Deployment Flow

1. **Trigger**: PR is opened, synchronized, or reopened
2. **Template Rendering**: `docker-compose.preview.tpl.yml` is rendered with PR-specific variables
3. **Image Building**: Docker images are built with GitHub Actions cache
4. **Stack Deployment**: Uncloud deploys all services with unique names
5. **Domain Routing**: Uncloud configures HTTPS routing based on `x-ports`
6. **Initialization**: Migrations and seeds are executed inside the API container
7. **Notification**: PR is commented with preview URLs and test credentials

### Cleanup Flow

1. **Trigger**: PR is closed
2. **Template Rendering**: Same template is rendered to extract service/volume names
3. **Resource Removal**: All PR-specific services and volumes are deleted
4. **Verification**: Uncloud confirms resource removal

### Domain Resolution

```
User Request (https://pr-123.preview.example.com)
  v
DNS Resolution (*.preview.example.com -> Host IP)
  v
Uncloud Reverse Proxy (reads x-ports configuration)
  v
Container (web-preview-pr-123:8080)
```

### Service Isolation

Each PR gets completely isolated resources:

```
PR #123                              PR #456
├── web-preview-pr-123              ├── web-preview-pr-456
├── api-preview-pr-123              ├── api-preview-pr-456
├── db-preview-pr-123               ├── db-preview-pr-456
│   └── db-preview-pr-123-data      │   └── db-preview-pr-456-data
├── redis-preview-pr-123            ├── redis-preview-pr-456
│   └── redis-preview-pr-123-data   │   └── redis-preview-pr-456-data
└── ...                             └── ...
```

## Troubleshooting

### Common Issues

**Issue: "Failed to connect to server"**

- Verify `UNCLOUD_CONNECT` format matches the input used in the `uc machine init`
- Ensure SSH key has correct permissions
- Test SSH connection manually `ssh -i key user@host`

**Issue: Connection refused**

- Sometimes host machine can actively reject connections, especially if it's under heavy load, but sometimes it's just a temporary issue, so give it a break and try again later.
- If connection is randomly but often refused, contact with the VPS provider to check if there are any issues with their infrastructure.

**Issue: "Domain not accessible"**

- Check DNS propagation: `dig preview-domain.example.com`
- Verify `x-ports` configuration in docker-compose template
- Check Uncloud logs: `uc logs service-name` / `uc ls` / `uc inspect service-name`

**Issue: "Something happened inside of the container"**

- Check Uncloud logs: `uc logs service-name` / `uc ls` / `uc inspect service-name`
- Connect to the continers shell: `uc exec service-name` and run some commands to debug the issue

### Debugging Commands

```bash
# List all running services with bindings, replicas, mode, etc.
uc ls

# List all running services with Docker output (more verbose, but without Uncloud specific information)
uc ps

# View service logs
uc logs service-name

# Connect to the continers shell
uc exec service-name
```

## Best Practices

1. **Naming Convention**: Always use some unique suffix, e.g. `${PR_ID}`, for isolation and easier identification of the resources
2. **Dockerfile/Compose** Compose have to work out of the box, if not, Uncloud will not work as well
3. **Cache Strategy**: Use GitHub Actions cache for faster builds
4. **Secrets Management**: Generate ephemeral secrets per PR, avoid hardcoding
5. **Path Triggers**: Only trigger on relevant file changes to save CI minutes
6. **Concurrency**: Use `concurrency` with `cancel-in-progress: true` to prevent duplicate deployments and conflicts (parallel deployments of the same PR and interactions with the same resources)
7. **Error Handling**: Use `continue-on-error: true` for non-critical steps (like seeding), especially if you want to avoid failing on the second and next attempts to deploy the same PR.
