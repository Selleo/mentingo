# Course Discussions Business Spec

## Business Overview

Course Discussions gives enrolled learners a course-level conversation space. Learners can start discussion threads, reply to classmates, react to messages, mention other enrolled learners, and remove their own messages when permitted.

For HR and L&D teams, discussions add peer learning and course-specific collaboration without requiring an external chat tool.

## Who Uses It

- Learners who ask questions, share reflections, and reply to classmates inside a course.
- Trainers and course managers who monitor or moderate course conversation.
- Administrators who enable or disable course discussions at tenant level.
- Mentioned learners who need to respond to a discussion item.

## Feature Functions

- Show a Discussion tab on enrolled course pages when discussions are enabled.
- Create top-level discussion threads.
- Reply to an existing thread.
- React to messages and toggle reactions.
- Mention other enrolled course users.
- Show online presence for course discussion users.
- Soft-delete messages while preserving deleted placeholders when replies exist.
- Send realtime updates for new messages, reactions, deletions, mentions, and presence changes.

## End-User Value

Learners can collaborate around the course content where the learning happens. Mentions and realtime updates help participants notice relevant discussion activity. Moderation and delete permissions help keep the course space controlled.

## How It Works

When the tenant enables course discussions, enrolled learners see a Discussion tab on the course overview. The tab loads discussion threads and enrolled users, then joins a course-specific realtime room for updates.

Learners can post a new thread or open an existing thread to reply. Mentions are limited to enrolled users, and the system notifies mentioned users in realtime and through the event/email flow. Reactions and deletions are broadcast to the course room so other open sessions update without a full page reload.

Users must be enrolled in the course to read, post, react, or join the realtime discussion room.

## Key Technical Context

- Frontend UI lives under `apps/web/app/modules/Courses/CourseView/CourseChat`.
- API endpoints live under `apps/api/src/course-chat` and are feature-gated by `COURSE_DISCUSSIONS`.
- Core permissions include `COURSE_DISCUSSION_READ`, `COURSE_DISCUSSION_MESSAGE_CREATE`, `COURSE_DISCUSSION_MESSAGE_REACT`, `COURSE_DISCUSSION_MESSAGE_DELETE_OWN`, and `COURSE_DISCUSSION_MESSAGE_DELETE`.
- Realtime behavior uses Socket.IO rooms plus course-chat socket events for messages, reactions, deletion, mentions, and presence.
- Message and mention events are published through the existing outbox/event pattern.

## Test Evidence

- Web E2E coverage verifies the tab is hidden when globally disabled, empty state when enabled, creating threads, replying, reacting and toggling reactions, deleting a thread with replies, and selecting mentioned enrolled users.
- Backend behavior is evidenced by the Course Chat controller, service, gateway, and event handler implementation. No dedicated Course Chat backend E2E spec was found in the current API test tree.
