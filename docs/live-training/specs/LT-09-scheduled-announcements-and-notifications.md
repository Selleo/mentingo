# LT-09 Scheduled Announcements And Live Training Notifications

## Goal

Use announcements as the simple, durable notification payload for scheduled manual announcements and Live Training notifications.

## Decisions

- Announcements remain simple: localized `title` and `content` are the message.
- No metadata JSONB and no delivery job table in this slice.
- `source_type` and `source_id` link an announcement to its primary domain entity.
- `email_template` selects the email layout and distinguishes Live Training reminder/start/end notifications.
- User-facing announcement rows are created only when an announcement is published.
- Cron only publishes due scheduled rows. Domain modules own timing rules.

## Implementation Checklist

- [x] Add shared announcement status/source/template constants.
- [x] Extend announcement DB schema with scheduling/source/email fields.
- [x] Add announcement scheduler, delivery service, and 5-minute cron.
- [x] Publish side effects through outbox after due announcements become visible.
- [x] Add Live Training reminder/start/end announcement integration.
- [x] Add manual scheduled announcement API fields.
- [ ] Generate Drizzle migration.
- [ ] Regenerate API schema/client.
- [ ] Add scheduled announcement controls to the web create dialog.
- [ ] Show scheduled status in admin notification feed.
- [ ] Add API tests for scheduled visibility, cron publish, and Live Training reminder rules.
- [ ] Add focused web tests for scheduling controls.

## Live Training Rules

- Starts-soon reminder is scheduled for `startsAt - 15 minutes`.
- If `startsAt <= now`, cancel the scheduled starts-soon reminder.
- If `startsAt > now` and the reminder time is already due, publish the reminder immediately.
- If `startsAt > now` and the reminder time is future, create or update the scheduled reminder.
- Session start publishes an immediate Live Training started announcement.
- Session end publishes an immediate Live Training ended announcement.
