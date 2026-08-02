# Announcements and Notifications Business Spec

## Business Overview

Announcements and Notifications give Mentingo a built-in communication channel for learning operations. Administrators and permitted content creators can publish updates for everyone or for a selected group, while learners receive only messages relevant to them. System-generated notices are separated from manually authored admin announcements so users can understand why a message appeared.

For HR and L&D teams, this supports planned and targeted communication: onboarding reminders, course-related updates, live-training notices, compliance nudges, and group-specific messages that should stay close to the learning experience.

The main workflow has two sides. A manager creates a localized announcement, chooses the audience, decides whether it should publish now or later, and optionally enables email delivery. Users can review All, Admin announcements, or System notifications, then mark personal deliveries as read. The feeds refresh every five minutes while remaining manually refreshable.

## Who Uses It

- Administrators publish organization-wide announcements, delete outdated manual messages, and review all manual announcements while receiving only system notifications relevant to their own learning activity.
- Content creators with announcement permissions publish updates for learning audiences they manage.
- HR and L&D teams schedule multilingual reminders or program updates for learners and selected groups.
- Learners read manual and system notifications delivered to them, track unread messages, and clear notifications after review.

## Feature Functions

- Create localized announcements with a base language and one or more translations.
- Target all users or a specific group so messages reach the right learners.
- Publish announcements immediately or schedule them for future delivery.
- Optionally send email copies when an announcement is published.
- Show unread counts and highlighted unread messages in the notification experience.
- Separate all messages into All, Admin announcements, and System feeds.
- Notify only users enrolled in a course containing the linked live-training lesson, including administrators who are enrolled as learners.
- Let learners mark one announcement or all announcements as read.
- Load more announcement history when the notification center has additional pages.
- Let users with delete permission remove announcements from the visible feed.

## End-User Value

Learners receive learning-related updates where they already work, instead of relying only on external email or chat tools. HR and L&D teams can coordinate communication across languages, audiences, and timing while keeping the message history available inside Mentingo.

Group and system targeting improve relevance: learners see updates meant for them, while unrelated groups and administrators are not interrupted by operational notifications they do not need.

## How It Works

A permitted user opens the notification center and creates an announcement. They write the title and content for the selected language, add more language versions when needed, choose everyone or a group, and decide whether to schedule the message or send email. Content creators can load existing groups for this audience selector without receiving access to the Groups management area. Mentingo validates the base language, duplicate languages, required content, schedule step, and permissions.

If the announcement is published immediately, Mentingo delivers it to the matching users. If it is scheduled, the scheduler later claims due announcements tenant by tenant and then delivers it. Manual announcements appear under Admin announcements; automated messages such as live-training notices appear under System; All combines both without changing audience eligibility.

Managers with announcement-management permissions can review every manual announcement even when they were not personally targeted. A manager receives read state only when the announcement was delivered to them, such as through group membership. System notifications remain personal for every role. Live-training notifications go only to users enrolled in a linked course that contains the live-training lesson.

When a learner is mentioned in a course discussion, Mentingo creates the system notification in every supported language and uses the course title translated for each language, falling back to the course's base language when a translation is unavailable.

## Key Technical Context

- Frontend notification center lives at `/notifications` in `apps/web/app/modules/Notifications`.
- API endpoints live in `apps/api/src/announcements/announcements.controller.ts`.
- Access is controlled by `ANNOUNCEMENT_READ`, `ANNOUNCEMENT_CREATE`, and `ANNOUNCEMENT_DELETE`.
- Content creators use read-only group access to populate announcement audiences; group management remains administrator-only and the Groups navigation tab stays hidden.
- Scheduling and publishing are handled by `AnnouncementsSchedulerService`; delivery to user feeds is handled by `AnnouncementsDeliveryService`.
- Announcement statuses are `scheduled` and `published`; source types include manual announcements, live training, and course due-date reminders.
- `manual` source types identify Admin announcements; every other source type identifies System notifications. Live-training notifications use a selected-user audience resolved from qualifying course enrollment.
- Course-discussion mention notifications resolve every localized course title in one tenant-scoped query before creating the multilingual notification.
- The frontend queries each feed independently and revalidates announcement data every five minutes.
- Announcement creation and read activity publish events that activity logs and email delivery consume.

## Test Evidence

API E2E coverage verifies the three feed classifications, manager visibility of manual announcements, personal system eligibility, manager group read state, localized responses, unread counts, creation validation, scheduling, read/read-all actions, soft deletion, and permission denial for unauthorized users. Live-training E2E coverage verifies that enrolled learners and enrolled administrators receive notifications while unrelated users do not.

Web E2E coverage verifies the three tabs, manual announcement classification, admin creation, localized creation, group announcements, deletion, learner reading from the popover, notification-center navigation, mark-one and mark-all read flows, pagination, localized content, and group visibility.
