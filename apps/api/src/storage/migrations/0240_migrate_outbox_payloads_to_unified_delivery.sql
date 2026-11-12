-- Custom SQL migration file, put you code below! --
-- Events now store their data under one named field, like every other outbox event.
UPDATE "outbox_events" AS "event"
SET "payload" = jsonb_build_object("wrapper"."field", "event"."payload")
FROM (
  VALUES
    ('NotificationEvent', 'notificationData'),
    ('AutomationEmailDeliveryRequestedEvent', 'emailDeliveryRequestData'),
    ('NativeArchiveImportFinishedEvent', 'importFinishedData'),
    ('ContentMarketplaceCourseCopiedEvent', 'courseCopiedData'),
    ('CourseDuplicatedEvent', 'courseDuplicatedData'),
    ('CourseTransferRequestedEvent', 'transferRequestData'),
    ('CourseTransferVideoMetadataRequestedEvent', 'videoMetadataRequestData'),
    ('QuizCompletedEvent', 'quizCompletionData'),
    ('UserActivityEvent', 'userActivityData')
) AS "wrapper" ("event_type", "field")
WHERE "event"."event_type" = "wrapper"."event_type"
  AND "event"."payload" <> '{}'::jsonb
  AND NOT "event"."payload" ? "wrapper"."field";
--> statement-breakpoint
-- Notification preparers used to run while an event was published, so every source event
-- already in the outbox has had its notifications published.
UPDATE "outbox_events" AS "event"
SET "succeeded_handlers" = "event"."succeeded_handlers" || jsonb_build_array("preparer"."handler_name")
FROM (
  VALUES
    ('UserFirstLoginEvent', 'NotifyUsersHandler'),
    ('UsersAssignedToCourseEvent', 'NotifyUsersHandler'),
    ('UsersShortInactivityEvent', 'NotifyUsersHandler'),
    ('UsersLongInactivityEvent', 'NotifyUsersHandler'),
    ('UserChapterFinishedEvent', 'NotifyUsersHandler'),
    ('UserCourseFinishedEvent', 'NotifyUsersHandler'),
    ('UserRegisteredEvent', 'NotifyAdminsHandler'),
    ('UserPasswordCreatedEvent', 'NotifyAdminsHandler'),
    ('CourseCompletedEvent', 'NotifyAdminsHandler'),
    ('CertificateExpirationWarningEmailEvent', 'CertificateEmailHandler'),
    ('CertificateArchivedEmailEvent', 'CertificateEmailHandler'),
    ('AnnouncementPublishedEvent', 'AnnouncementEmailHandler'),
    ('CourseChatUserMentionedEvent', 'CourseChatMentionEmailHandler'),
    ('CourseDueDateReminderEmailEvent', 'CourseDueDateReminderEmailHandler')
) AS "preparer" ("event_type", "handler_name")
WHERE "event"."event_type" = "preparer"."event_type"
  AND "event"."status" <> 'published'
  AND NOT "event"."succeeded_handlers" ? "preparer"."handler_name";
