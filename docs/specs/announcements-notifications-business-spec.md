# Announcements and Notifications Business Spec

## Business Overview

Announcements and Notifications give Mentingo a built-in communication channel for learning operations. Administrators and permitted content creators can publish updates for everyone or for a selected group, while learners receive only messages relevant to them. System-generated notices are separated from manually authored admin announcements so users can understand why a message appeared.

For HR and L&D teams, this supports planned and targeted communication: onboarding reminders, course-related updates, live-training notices, compliance nudges, and group-specific messages that should stay close to the learning experience.

The main workflow has two sides. A manager creates a localized announcement, chooses the audience, decides whether it should publish now or later, and optionally enables email delivery. Users can review All, Admin announcements, or System notifications, then mark personal deliveries as read. The feeds refresh every five minutes while remaining manually refreshable. Notifications about replies and mentions in discussions arrive at once: the unread counter and the lists update without reloading the page.

## Who Uses It

- Administrators publish organization-wide announcements, delete outdated manual messages, and review all manual announcements while receiving only system notifications relevant to their own learning activity.
- Content creators with announcement permissions publish updates for learning audiences they manage and review their own announcements or messages delivered to them.
- HR and L&D teams schedule multilingual reminders or program updates for learners and selected groups.
- Learners read manual and system notifications delivered to them, track unread messages, and clear notifications after review.

## Feature Functions

- Create localized announcements with a base language and one or more translations.
- Target all users or a specific group so messages reach the right learners.
- Publish announcements immediately or schedule them for future delivery.
- Optionally send email copies when an announcement is published.
- Show unread counts and highlighted unread messages in the notification experience.
- Notify the people taking part in a course discussion thread or a forum topic when someone replies, with a link that opens that thread or topic.
- Email those participants about replies they have not read in the application, with the replies of one thread grouped into a single email.
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

Administrators and users with full announcement-management permission can review every manual announcement even when they were not personally targeted. Content creators can review their own manual announcements and manual announcements delivered to them. A user receives personal read state only when the announcement was delivered to them, such as through group membership. System notifications remain personal for every role. Live-training notifications go only to users enrolled in a linked course that contains the live-training lesson.

When a learner is mentioned in a course discussion, Mentingo creates the system notification in every supported language and uses the course title translated for each language, falling back to the course's base language when a translation is unavailable.

When someone replies in a course discussion thread or a forum topic, Mentingo notifies the author of the thread and everyone who replied in it earlier. The person who wrote the reply is never notified, and a participant mentioned in the reply gets only the mention notification, not a second one. People who can no longer open the discussion are left out: learners who are no longer enrolled in the course, were archived or lost access to course discussions, and users without access to the forum. The notification opens the thread in the course's Discussion tab, on whichever page of the discussion it is, or the forum topic. The link is used once: reopening the Discussion tab later does not jump back to that thread, and following the same notification again opens it again. For the recipients the unread counter and the notification lists update at once, in every open session.

The same people also get an email, but not for every reply. The first reply in a thread starts a 15-minute wait for each recipient, and every further reply in that thread joins the same email. When the wait ends, the email names the discussion, the number of new replies, who wrote them and the latest reply, and links to the thread. It counts only the replies whose notification the recipient has not read and which were not deleted since, and the authors and the latest reply are taken from those same replies. Someone who already saw them in the application gets no email, and neither does someone who lost access to the discussion in the meantime. Replies that arrive after the email was sent start a new wait. A reply that mentions a participant is left out of that participant's grouped email, because the mention has its own email. Administrators can edit or turn off both emails in Automations.

## Key Technical Context

- Frontend notification center lives at `/notifications` in `apps/web/app/modules/Notifications`.
- API endpoints live in `apps/api/src/announcements/announcements.controller.ts`.
- Access is controlled by `ANNOUNCEMENT_READ`, `ANNOUNCEMENT_CREATE`, and `ANNOUNCEMENT_DELETE`.
- Content creators use read-only group access to populate announcement audiences; group management remains administrator-only and the Groups navigation tab stays hidden.
- Scheduling and publishing are handled by `AnnouncementsSchedulerService`; delivery to user feeds is handled by `AnnouncementsDeliveryService`.
- Announcement statuses are `scheduled` and `published`; source types include manual announcements, live training, and course due-date reminders.
- `manual` source types identify Admin announcements; every other source type identifies System notifications. Live-training notifications use a selected-user audience resolved from qualifying course enrollment.
- Course-discussion mention notifications resolve every localized course title in one tenant-scoped query before creating the multilingual notification.
- Reply notifications are created by `DiscussionReplyNotificationHandler` in `apps/api/src/discussion-notifications`, which handles `CourseChatReplyCreatedEvent` and `ForumReplyCreatedEvent` from the outbox with one service for both kinds of discussion.
- `announcements.link_path` stores the in-app path a notification opens when the source type and id cannot name it, such as a single course discussion thread. The web app follows it only when it stays inside the application.
- A reply or mention notification is stored together with a `UserNotificationsCreatedEvent`. Its handler runs after that transaction is committed and sends `NOTIFICATION_SOCKET_EVENTS.CREATED`, a signal without content, to each recipient's user room, so a client never refreshes before the notification can be read; `useLiveNotifications` then refreshes the unread counter and the lists. Other system notifications still rely on the five-minute refresh.
- Reply emails use the built-in automation `discussion_reply`. Storing a reply notification adds it to the recipient's row in `discussion_reply_digests` (one row per user and thread, protected by tenant row-level security) or creates the row with `send_after` 15 minutes ahead. Each row lists its replies as pairs of reply and notification. `DiscussionReplyDigestCron` runs every minute for each tenant; `DiscussionReplyDigestService` handles every due row in its own transaction: it claims the row with `FOR UPDATE SKIP LOCKED`, publishes one `NotificationEvent` and deletes the row. An email that fails does not hold back the others; its row is retried 15 minutes later.
- The frontend queries each feed independently and revalidates announcement data every five minutes.
- Announcement creation and read activity publish events that activity logs and email delivery consume.

## Test Evidence

API E2E coverage verifies the three feed classifications, administrator visibility of manual announcements, content-creator ownership and recipient visibility, personal system eligibility, manager group read state, localized responses, unread counts, creation validation, scheduling, read/read-all actions, soft deletion, and permission denial for unauthorized users. Live-training E2E coverage verifies that enrolled learners and enrolled administrators receive notifications while unrelated users do not. Discussion reply E2E coverage verifies the recipients in course threads and forum topics (thread author and earlier repliers), that the reply's author and bystanders get nothing, that a mentioned participant is not notified twice, that learners who left the course, archived users and users without access to course discussions are skipped, that a reply event stored without its mentions is still delivered, the link to the thread, the live signal sent only to recipients, and that a reply event cannot notify users of another organization. Discussion reply email E2E coverage verifies that replies of one topic become one email per participant after the delay and nothing before it, that later repliers are not told about earlier replies, that a participant who read the notifications gets no email and later replies start a new one, the link to a course thread, that learners who left the course get nothing, that deleted replies and replies mentioning the recipient are neither counted nor quoted, that a participant without saved settings is emailed in English, that one failing email does not stop the others and is sent on a later run, and that a mentioned participant gets the mention email at once and no grouped email for that reply.

Web unit tests cover the live refresh of the counter and lists (also after a reconnect), following a stored notification link only inside the application (protocol-relative addresses are rejected), and opening the linked thread in a course's Discussion tab on the page that holds it, once per link.

Web E2E coverage verifies the three tabs, manual announcement classification, admin creation, localized creation, group announcements, deletion, learner reading from the popover, notification-center navigation, mark-one and mark-all read flows, pagination, localized content, and group visibility.
