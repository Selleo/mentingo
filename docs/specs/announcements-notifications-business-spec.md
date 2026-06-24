# Announcements and Notifications Business Spec

## Business Overview

Announcements and Notifications give Mentingo a built-in communication channel for learning operations. Administrators and permitted content creators can publish updates for everyone or for a selected group, while learners receive those messages in the notification popover and notification center.

For HR and L&D teams, this supports planned and targeted communication: onboarding reminders, course-related updates, live-training notices, compliance nudges, and group-specific messages that should stay close to the learning experience.

The main workflow has two sides. A manager creates a localized announcement, chooses the audience, decides whether it should publish now or later, and optionally enables email delivery. A learner sees relevant unread messages, opens them from the notification popover or `/notifications`, and marks one or all messages as read.

## Who Uses It

- Administrators publish organization-wide announcements, delete outdated messages, and review the tenant's announcement history.
- Content creators with announcement permissions publish updates for learning audiences they manage.
- HR and L&D teams schedule multilingual reminders or program updates for learners and selected groups.
- Learners read relevant announcements, track unread messages, and clear notifications after review.

## Feature Functions

- Create localized announcements with a base language and one or more translations.
- Target all users or a specific group so messages reach the right learners.
- Publish announcements immediately or schedule them for future delivery.
- Optionally send email copies when an announcement is published.
- Show unread counts and highlighted unread messages in the notification experience.
- Let learners mark one announcement or all announcements as read.
- Load more announcement history when the notification center has additional pages.
- Let users with delete permission remove announcements from the visible feed.

## End-User Value

Learners receive learning-related updates where they already work, instead of relying only on external email or chat tools. HR and L&D teams can coordinate communication across languages, audiences, and timing while keeping the message history available inside Mentingo.

Group targeting improves relevance: learners see updates meant for them, while unrelated groups are not interrupted by messages they do not need.

## How It Works

A permitted user opens the notification center and creates an announcement. They write the title and content for the selected language, add more language versions when needed, choose everyone or a group, and decide whether to schedule the message or send email. Mentingo validates the base language, duplicate languages, required content, schedule step, and permissions.

If the announcement is published immediately, Mentingo delivers it to the matching users. If it is scheduled, the scheduler later claims due announcements tenant by tenant and then delivers them. Learners see their own feed and unread count; managers with announcement management permissions see the broader admin announcement feed.

System-generated announcements can also use the same scheduling and delivery services for source-driven messages such as live-training or course-reminder flows.

## Key Technical Context

- Frontend notification center lives at `/notifications` in `apps/web/app/modules/Notifications`.
- API endpoints live in `apps/api/src/announcements/announcements.controller.ts`.
- Access is controlled by `ANNOUNCEMENT_READ`, `ANNOUNCEMENT_CREATE`, and `ANNOUNCEMENT_DELETE`.
- Scheduling and publishing are handled by `AnnouncementsSchedulerService`; delivery to user feeds is handled by `AnnouncementsDeliveryService`.
- Announcement statuses are `scheduled` and `published`; source types include manual announcements, live training, and course due-date reminders.
- Announcement creation and read activity publish events that activity logs and email delivery consume.

## Test Evidence

API E2E coverage verifies fetching announcement feeds, localized responses, unread counts, current-user feeds, group visibility, creation validation, scheduling, read/read-all actions, soft deletion, and permission denial for unauthorized users.

Web E2E coverage verifies admin creation, localized creation, group announcements, deletion, learner reading from the popover, notification-center navigation, mark-one and mark-all read flows, pagination, localized content, and group visibility.
