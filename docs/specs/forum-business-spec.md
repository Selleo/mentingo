# Forum Business Spec

## Business Overview

The Forum gives the whole organization one place for conversations that are not tied to a single course. People start a topic with a title and a first message, colleagues reply, and earlier answers stay easy to find instead of being asked again.

For HR and L&D teams, the forum is a lightweight knowledge exchange inside the learning platform: onboarding questions, tool tips and cross-team learning sit next to the courses. Course discussions are part of the same space. A learner sees the threads from their enrolled courses alongside the organization-wide topics, while each course's Discussion tab keeps working as before.

Administrators turn the forum on in the platform settings. Until they do, nothing changes for users.

## Who Uses It

- Learners ask how-to questions, share tips with colleagues and follow the discussions from their courses in one list.
- HR and L&D staff open organization-wide topics, such as onboarding questions, that invite replies from everyone.
- Administrators enable the forum and remove posts that should not stay visible.

## Feature Functions

- Start an organization-wide topic with a title and a first message.
- Reply to topics and read the replies page by page.
- React to posts with the same set of reactions as course discussions.
- Mention colleagues in a topic or a reply; they get a notification that opens the topic.
- See new topics, replies and reactions without reloading the page.
- Browse topics with search, a General or per-course filter, and sorting by latest activity, newest or most replies.
- See course discussion threads from your enrolled courses next to the organization-wide topics.
- Delete your own posts; administrators can delete any post.
- Turn the forum on or off for the organization; the navigation entry appears only when it is on.

## End-User Value

Learners get answers faster and from more colleagues than within a single course, and they keep course conversations and general questions in one place. HR and L&D teams gain a searchable record of recurring questions and a channel for peer support without introducing another tool.

## How It Works

A user opens Forum from the navigation, browses or searches the topics and opens one to read the first message and the replies. To ask something new, they choose New topic and enter a title and a message; new topics are organization-wide, while course threads are started from the course's Discussion tab. Replies are added at the bottom of the topic.

While writing a topic or a reply, typing `@` suggests people to mention. In organization-wide topics these are the users who can view the forum; in course threads they are the people enrolled in the course. In organization-wide topics a mentioned user gets a notification in the application that links to the topic, and a message on screen when they have the forum open; a mention in a course thread is delivered the same way as one written in the course's Discussion tab. Only people actually named in the text are notified, up to 20 per post. Readers can react to a post, and select a reaction again to take it back. The topic list and an open topic refresh on their own when someone adds a topic, a reply or a reaction.

Access is controlled by five permissions: view the forum, create topics, reply, react, and delete any post. By default every role except Reviewer can view, create topics, reply and react, and only administrators can delete other people's posts. Reviewers have no forum access, because that role is limited to grading. Threads from a course appear only for people enrolled in that course, and only while course discussions are enabled; for everyone else those threads do not exist. A thread started in a course's Discussion tab shows up in the forum, and replies posted to it from the forum show up in the Discussion tab. Course threads keep the course discussion rules, so posting in them requires enrollment and the course discussion permissions.

Authors can delete their own posts, and administrators can delete any post. When the first message of a topic is deleted while replies remain, the topic stays with a deleted placeholder and new replies are closed. When no replies remain, the topic disappears.

The forum is off by default. An administrator enables it in the platform settings, next to course discussions.

## Key Technical Context

- Web pages live in `apps/web/app/modules/Forum` at `/forum` and `/forum/topics/:topicId`; the navigation entry and pages depend on the `forumEnabled` global setting (`FEATURES.FORUM`).
- The API lives in `apps/api/src/forum`. It is feature-gated and uses `PERMISSIONS.FORUM_READ`, `PERMISSIONS.FORUM_TOPIC_CREATE`, `PERMISSIONS.FORUM_POST_CREATE`, `PERMISSIONS.FORUM_POST_REACT` and `PERMISSIONS.FORUM_POST_DELETE`. Authors delete their own posts without a separate permission; deleting other people's posts in organization-wide topics needs `PERMISSIONS.FORUM_POST_DELETE`.
- Forum topics and course discussion threads share the course discussion tables with a `general` or `course` scope. Replies and deletions in course threads made from the forum go through the course discussion service, so course events and live updates in the Discussion tab keep working.
- Topics a user cannot access are reported as not found, and the discussion tables keep their tenant row-level security.
- Live updates use Socket.IO rooms: one per organization for the topic list and one per organization-wide topic. They carry only a signal to reload, never post content. A course thread opened in the forum listens on the course discussion room instead.
- New organization-wide topics and replies are recorded as domain events through the outbox. A mention is a domain event too, and its handler creates the in-application notification.

## Test Evidence

- API E2E coverage verifies the feature gate, authentication and the permission required for each action, every system role creating and replying, sorting, filters, search and pagination, course threads visible only to enrolled users and hidden when course discussions are off, replying to course threads from the forum, own and moderator deletion with placeholders and the signal that a topic was removed, reactions on organization-wide posts and course threads, the list of users who can be mentioned and who gets notified, the live signals and the recorded domain events, input validation, and tenant isolation through the row-level-security proxy.
- Web unit tests cover the list parameters, the forum permission helpers and the navigation entry. Page tests cover an unknown course filter, a page that no longer exists, the redirect while the forum is off, a missing topic, leaving a topic once its last post is deleted, reacting to a post, sending mentions with a reply, and reloading after a live signal. A Playwright spec added with the web forum covers the disabled forum, creating a topic and a reply, and course threads visible only to enrolled users.
- Notifications about replies and e-mails about mentions in organization-wide topics are not part of the forum yet.
