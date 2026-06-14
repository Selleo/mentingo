# Announcements and Notifications Business Spec

## Business Overview

Announcements and Notifications give the platform a controlled communication channel for operational updates, learning reminders, and group-specific messages. Administrators can publish multilingual announcements immediately or schedule them for later delivery.

The notification center gives learners and staff a persistent place to read, mark, and revisit messages.

## Who Uses It

- Administrators who publish tenant-wide or group-specific announcements.
- HR and L&D teams who need scheduled communication around learning programs.
- Learners who receive and read notifications.
- Trainers and course managers who need a consistent way to reach participants when linked workflows generate announcements.

## Feature Functions

- Create announcements with one or more language translations.
- Choose the base language for fallback content.
- Target all users or a specific group.
- Publish immediately or schedule for a future date and time.
- Optionally send announcement emails.
- Show unread counts and unread badges.
- Mark one announcement as read or mark all as read.
- Delete announcements when permitted.
- Load paginated announcement history in the notification center.
- Localize title and content according to the user interface language.

## End-User Value

Learners receive relevant updates in the platform and, when configured, by email. Administrators can coordinate communication without relying on external tools. Group targeting keeps messages focused, while scheduled delivery supports planned program communication.

## How It Works

Administrators create announcements from the notification UI. The system validates translations, base language, target group, and scheduling rules. Immediate announcements are delivered right away; scheduled announcements are claimed and published when due.

Published announcements create user-specific notification records. Users see unread counts, can mark messages as read, and can browse their own feed. Administrators and permitted users can also view broader announcement history and delete announcements.

Email delivery is event-driven. When an announcement is published and email sending is enabled, recipients receive localized content using the best available translation fallback.

## Key Technical Context

- Frontend route: `/notifications`.
- API endpoints are implemented under `apps/api/src/announcements`.
- Permissions include `ANNOUNCEMENT_READ`, `ANNOUNCEMENT_CREATE`, and `ANNOUNCEMENT_DELETE`.
- Delivery is split across announcement service, scheduler service, delivery service, and email event handler.
- Scheduled announcements are stored as scheduled, later published by the scheduler, then delivered to users.
- Announcement events also support source-driven system announcements, including Live Training email templates.

## Test Evidence

- API E2E coverage verifies fetching announcements, language fallback, unread counts, current-user feeds, group targeting, creation validation, scheduled delivery, read/read-all actions, soft deletion, and permission denial for unauthorized users.
- Web E2E coverage verifies learner reading flows, notification center navigation, mark-read and mark-all-read behavior, pagination, localized content, admin creation, group-specific announcements, and deletion.
