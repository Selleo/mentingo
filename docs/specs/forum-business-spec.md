# Forum Business Spec

## Business Overview

The Forum gives the whole organization one place for conversations that are not tied to a single course. People start a topic with a title and a first message, colleagues reply, and earlier answers stay easy to find instead of being asked again.

For HR and L&D teams, the forum is a lightweight knowledge exchange inside the learning platform: onboarding questions, tool tips and cross-team learning sit next to the courses. Course discussions are part of the same space without crowding it. The forum lists one entry per course the learner is enrolled in, with the number of messages and the latest activity. Opening it shows that course's discussion inside the forum as a single topic, while the course's Discussion tab keeps working as before.

Administrators turn the forum on in the platform settings. Until they do, nothing changes for users.

## Who Uses It

- Learners ask how-to questions, share tips with colleagues and follow the discussions of their courses from the forum.
- HR and L&D staff open organization-wide topics, such as onboarding questions, that invite replies from everyone.
- Administrators enable the forum and remove posts that should not stay visible.

## Feature Functions

- Start an organization-wide topic with a title and a first message.
- Reply to topics and read the replies page by page.
- React to posts with the same set of reactions as course discussions.
- Mention colleagues in a topic or a reply; they get a notification that opens the topic.
- See new topics, replies and reactions without reloading the page.
- Browse topics with search and sorting by latest activity, newest or most replies.
- See which of your courses have an active discussion and read, post, reply and react in it without leaving the forum.
- Delete your own posts; administrators can delete any post.
- Turn the forum on or off for the organization; the navigation entry appears only when it is on.

## End-User Value

Learners get answers faster and from more colleagues than within a single course, and they keep course conversations and general questions in one place. HR and L&D teams gain a searchable record of recurring questions and a channel for peer support without introducing another tool.

## How It Works

A user opens Forum from the navigation, browses or searches the topics and opens one to read the first message and the replies. To ask something new, they choose New topic and enter a title and a message; every topic is organization-wide. Replies are added at the bottom of the topic.

While writing a topic or a reply, typing `@` suggests the users who can view the forum. A mentioned user gets a notification in the application that links to the topic, and a message on screen when they have the forum open. Only people actually named in the text are notified, up to 20 per post. Readers can react to a post, and select a reaction again to take it back. The topic list and an open topic refresh on their own when someone adds a topic, a reply or a reaction.

Access is controlled by five permissions: view the forum, create topics, reply, react, and delete any post. By default every role except Reviewer can view, create topics, reply and react, and only administrators can delete other people's posts. Reviewers have no forum access, because that role is limited to grading. Above the topics, the Course discussions section shows the five enrolled courses with the most recent messages. When there are more, a link opens a separate page that lists all of them with search by course name and pages of 20, so the forum stays readable for people enrolled in hundreds of courses. A row opens the course discussion as one forum page: the course's messages are shown like the posts of a topic, with replies under the message they answer and a field for a new message at the bottom. The page opens on the most recent messages in chronological order, and older messages are on the following pages. Reading, posting, replying, reacting, mentioning and deleting follow the course discussion rules, and everything written there appears in the course's Discussion tab and the other way round. The section and the page are available only to users who can read course discussions, only for courses they are enrolled in, and only while course discussions are enabled. Single course messages are not forum topics: they are not listed or searched among the topics.

Authors can delete their own posts, and administrators can delete any post. When the first message of a topic is deleted while replies remain, the topic stays with a deleted placeholder and new replies are closed. When no replies remain, the topic disappears.

The forum is off by default. An administrator enables it in the platform settings, next to course discussions.

## Key Technical Context

- Web pages live in `apps/web/app/modules/Forum` at `/forum` and `/forum/topics/:topicId`; the navigation entry and pages depend on the `forumEnabled` global setting (`FEATURES.FORUM`).
- The API lives in `apps/api/src/forum`. It is feature-gated and uses `PERMISSIONS.FORUM_READ`, `PERMISSIONS.FORUM_TOPIC_CREATE`, `PERMISSIONS.FORUM_POST_CREATE`, `PERMISSIONS.FORUM_POST_REACT` and `PERMISSIONS.FORUM_POST_DELETE`. Authors delete their own posts without a separate permission; deleting other people's posts needs `PERMISSIONS.FORUM_POST_DELETE`.
- Forum topics and course discussion threads share the course discussion tables with a `general` or `course` scope. Forum endpoints read and change only `general` threads; a course thread addressed through them is reported as not found. The discussion tables keep their tenant row-level security.
- `GET /forum/course-discussions` returns the per-course summary (course, message count, latest activity) for the viewer's enrolled courses that have messages, paginated, ordered by latest activity and searchable by course title; the list page is `/forum/courses`. `GET /forum/course-discussions/:courseId` returns the summary of one enrolled course. Without `PERMISSIONS.COURSE_DISCUSSION_READ`, or while course discussions are disabled, the list is empty and a single course is reported as not found.
- The course discussion page at `/forum/courses/:courseId` reads and writes through the course discussion API and its live room, so enrollment, permissions, mentions and notifications are the same as in the Discussion tab.
- Live updates use Socket.IO rooms: one per organization for the topic list and one per topic. They carry only a signal to reload, never post content. A new or deleted course message sends the same signal, which refreshes the Course discussions section.
- New topics and replies are recorded as domain events through the outbox. A mention is a domain event too, and its handler creates the in-application notification.

## Test Evidence

- API E2E coverage verifies the feature gate, authentication and the permission required for each action, every system role creating and replying, sorting, search and pagination, the per-course summary limited to enrolled courses, its search and pagination, and its being empty without the course discussion permission or while course discussions are off, the summary of one course for enrolled users only, course threads being absent from the topic list and unreachable through forum topic endpoints, the forum signal after a course message is posted or deleted, own and moderator deletion with placeholders and the signal that a topic was removed, reactions, the list of users who can be mentioned and who gets notified, the live signals and the recorded domain events, input validation, and tenant isolation through the row-level-security proxy.
- Web unit tests cover the list parameters, the forum permission helpers and the navigation entry. Page tests cover the course discussion links, the course discussion page (messages with replies under them, a missing discussion, posting with mentions, replying, read-only users and reloading after a live event), the five-course preview with its link to all course discussions, the list page (search and page from the URL, a page that no longer exists, an empty search), hiding the section from users who cannot read course discussions, a page that no longer exists, the redirect while the forum is off, a missing topic, leaving a topic once its last post is deleted, reacting to a post, sending mentions with a reply, and reloading after a live signal. A Playwright spec covers the disabled forum, creating a topic and a reply, and reading a course discussion in the forum as an enrolled user; its course discussion scenario was updated with this change and has not been run yet.
- Notifications about replies and e-mails about forum mentions are not part of the forum yet.
