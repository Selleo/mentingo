# Automation Data Layer Architecture

## Overview

This document describes the frontend data layer for the Automation module.
The architecture follows existing Mentingo patterns (TanStack Query hooks + generated API client) and is designed to be plugged into a real backend with minimal changes.

## File Structure

```
apps/web/app/api/
├── queries/admin/
│   ├── automation.types.ts        ← Shared types (domain, response, body)
│   ├── useAutomations.ts          ← List query (paginated, filterable)
│   └── useAutomationById.ts       ← Single automation detail + nodes
├── mutations/admin/
│   ├── useCreateAutomation.ts     ← POST /api/automations
│   ├── useUpdateAutomation.ts     ← PATCH /api/automations/:id
│   └── useDeleteAutomation.ts     ← DELETE /api/automations/:id
```

## Expected Backend API Contract

### Endpoints

| Method | Path                   | Description                               |
| ------ | ---------------------- | ----------------------------------------- |
| GET    | `/api/automations`     | List all automations (paginated)          |
| GET    | `/api/automations/:id` | Get single automation with full node tree |
| POST   | `/api/automations`     | Create new automation (Draft)             |
| PATCH  | `/api/automations/:id` | Update automation fields and/or node tree |
| DELETE | `/api/automations/:id` | Hard-delete or archive automation         |

### Query Parameters (GET /api/automations)

| Param   | Type   | Description                                          |
| ------- | ------ | ---------------------------------------------------- |
| search  | string | Filter by name/description (ILIKE)                   |
| status  | string | Filter by status (Draft, Active, Disabled, Archived) |
| page    | number | Page number (1-based)                                |
| perPage | number | Items per page (default: 20)                         |

### Response Shapes

All responses follow the existing `BaseResponse` / `PaginatedResponse` pattern from the API.

#### GET /api/automations

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Course deadline reminder",
      "description": "Sends email 7 days before deadline",
      "status": "Active",
      "trigger": "course_deadline",
      "actionsCount": 2,
      "lastRun": { "date": "2026-07-15T08:12:00Z", "status": "success" },
      "createdAt": "2026-07-01T10:00:00Z",
      "updatedAt": "2026-07-10T14:30:00Z"
    }
  ],
  "pagination": { "total": 42, "page": 1, "perPage": 20 }
}
```

#### GET /api/automations/:id

```json
{
  "data": {
    "id": "uuid",
    "name": "Course deadline reminder",
    "description": "...",
    "status": "Active",
    "nodes": [
      {
        "id": "node-uuid-1",
        "kind": "trigger",
        "type": "course_deadline",
        "label": "Course deadline",
        "parentId": null,
        "children": ["node-uuid-2"],
        "config": { "daysBefore": "7", "courseId": "course-uuid" },
        "position": { "x": 0, "y": 0 }
      },
      {
        "id": "node-uuid-2",
        "kind": "action",
        "type": "send_email",
        "label": "Send email",
        "parentId": "node-uuid-1",
        "children": [],
        "config": { "subject": "Reminder", "body": "...", "recipient": "enrolled_user" },
        "position": { "x": 0, "y": 0 }
      }
    ],
    "createdAt": "2026-07-01T10:00:00Z",
    "updatedAt": "2026-07-10T14:30:00Z"
  }
}
```

### Request Bodies

#### POST /api/automations

```json
{ "name": "New automation", "description": "Optional" }
```

#### PATCH /api/automations/:id

```json
{
  "name": "Updated name",
  "status": "Active",
  "nodes": [
    /* full node tree — replaces existing */
  ]
}
```

All fields are optional. Only provided fields are updated.
When `nodes` is provided, the backend should **replace** the full node tree atomically.

#### DELETE /api/automations/:id

```json
{ "archive": false }
```

If `archive: true`, sets status to "Archived" instead of hard-deleting.

## Node Tree Design

The tree is stored as a **flat adjacency list**:

- Each node has `parentId` (null for roots) and `children` (array of child IDs).
- The frontend reconstructs the tree at render time from this flat list.
- On save, the frontend sends the full flat array back.

### Backend Storage Options

1. **JSON column**: Store `nodes` as a JSONB column on the `automations` table. Simple, good for MVP.
2. **Normalized table**: `automation_nodes` with `automation_id`, `parent_id`, `kind`, `type`, `config`, `position`. Better for querying/indexing.

## Status State Machine

```
Draft ──(activate)──► Active
  ▲                     │
  │                     ▼
  └──(back to draft)── Disabled ──(archive)──► Archived
```

- The builder's toggle switches between `Draft` ↔ `Active`.
- `Disabled` and `Archived` are set via the drawer or bulk actions.

## Integration Steps (when backend is ready)

1. Add the controller endpoints to the NestJS API.
2. Add Swagger decorators for request/response schemas.
3. Run `pnpm generate:client` to regenerate `generated-api.ts`.
4. Remove the `// TODO` comments in query/mutation hooks.
5. Replace manual type imports with generated types from `~/api/generated-api`.
6. The hooks, query keys, and invalidation logic stay the same.

## Query Key Structure

- `["automations"]` — list (invalidated on create/update/delete)
- `["automations", { automationId }]` — single item detail

## Usage in Components

```tsx
// List page
const { data: automations, isLoading } = useAutomations({ search, status });

// Builder page
const { data: automation } = useAutomationById(automationId);
const { mutateAsync: updateAutomation, isPending } = useUpdateAutomation();
const { mutateAsync: deleteAutomation } = useDeleteAutomation();

// Save handler in builder
await updateAutomation({
  automationId,
  body: { name, status, nodes: store.nodes },
});
```
