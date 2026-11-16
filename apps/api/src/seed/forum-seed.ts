import { faker } from "@faker-js/faker";
import {
  COURSE_CHAT_ALLOWED_REACTIONS,
  COURSE_ENROLLMENT,
  DISCUSSION_SCOPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
  type DiscussionScope,
} from "@repo/shared";
import * as dotenv from "dotenv";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { chunk, sampleSize } from "lodash";
import postgres from "postgres";

import {
  categories,
  courseChatMessageReactions,
  courseChatMessages,
  courseChatThreads,
  courses,
  settings,
  studentCourses,
  tenants,
  users,
} from "../storage/schema";

import {
  FORUM_SEED_ACTIVITY_DAYS_AGO,
  FORUM_SEED_AUTHOR_EMAIL,
  FORUM_SEED_BUSY_COURSE_MESSAGES,
  FORUM_SEED_CATEGORY,
  FORUM_SEED_COURSE_SUBJECTS,
  FORUM_SEED_COURSE_TITLE_PREFIX,
  FORUM_SEED_DEFAULT_COURSE_COUNT,
  FORUM_SEED_LONG_TOPIC_REPLIES,
  FORUM_SEED_MARKER_EMAIL,
  FORUM_SEED_MESSAGES_PER_COURSE,
  FORUM_SEED_PARTICIPANT_COUNT,
  FORUM_SEED_RANDOM_SEED,
  FORUM_SEED_REACTION_CHANCE,
  FORUM_SEED_REPLIES_PER_MESSAGE,
  FORUM_SEED_REPLIES_PER_TOPIC,
  FORUM_SEED_REPLY_CHANCE,
  FORUM_SEED_TOPIC_COUNT,
  FORUM_SEED_TOPIC_TITLES,
  FORUM_SEED_VIEWER_EMAILS,
} from "./forum-seed-data";
import {
  addEmailSuffix,
  assignSystemRoleToUser,
  getSeedTenantOrigins,
  getTenantEmailSuffix,
} from "./seed-helpers";

import type { ForumSeedPost } from "./seed.types";
import type { DatabasePg, UUIDType } from "../common";

dotenv.config({ path: "./.env" });

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const INSERT_BATCH_SIZE = 500;

const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

/**
 * Adds forum demo data on top of tenants that were already seeded with `pnpm db:seed`:
 * organization-wide topics with replies and reactions, and demo courses whose discussions the
 * seeded student and admin are enrolled in. It also turns the forum and course discussions on.
 * Nothing is deleted; a tenant that already has the data is skipped.
 */
async function seedForum() {
  faker.seed(FORUM_SEED_RANDOM_SEED);

  try {
    for (const origin of getSeedTenantOrigins()) {
      await seedTenant(origin);
    }
  } finally {
    await sqlConnect.end();
  }
}

async function seedTenant(origin: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.host, origin));
  if (!tenant) {
    console.log(`⏭️  ${origin}: tenant not found, run pnpm db:seed first`);
    return;
  }

  const emailSuffix = getTenantEmailSuffix(origin);
  const findUserIds = (emails: string[]) =>
    findUserIdsByEmail(
      tenant.id,
      emails.map((email) => addEmailSuffix(email, emailSuffix)),
    );

  const [alreadySeeded] = await findUserIds([FORUM_SEED_MARKER_EMAIL]);
  if (alreadySeeded) {
    console.log(`⏭️  ${origin}: forum data already seeded`);
    return;
  }

  const [courseAuthorId] = await findUserIds([FORUM_SEED_AUTHOR_EMAIL]);
  const viewerIds = await findUserIds(FORUM_SEED_VIEWER_EMAILS);
  if (!courseAuthorId || !viewerIds.length) {
    console.log(`⏭️  ${origin}: seeded users not found, run pnpm db:seed first`);
    return;
  }

  const participantIds = await createParticipants(tenant.id, emailSuffix);
  const posterIds = [...viewerIds, ...participantIds];

  await enableDiscussionFeatures(tenant.id);

  const courseIds = await createCourses(tenant.id, courseAuthorId);
  await enrollUsers(tenant.id, courseIds, posterIds);

  const coursePosts = courseIds.flatMap((courseId, courseIndex) =>
    buildCourseDiscussion(tenant.id, courseId, posterIds, courseIndex === 0),
  );
  const topics = Array.from({ length: FORUM_SEED_TOPIC_COUNT }, (_, topicIndex) =>
    buildTopic(tenant.id, posterIds, topicIndex),
  );

  await insertThreads(tenant.id, DISCUSSION_SCOPES.COURSE, coursePosts);
  await insertThreads(
    tenant.id,
    DISCUSSION_SCOPES.GENERAL,
    topics.flatMap((topic) => topic.posts),
    new Map(topics.map((topic) => [topic.threadId, topic.title])),
  );

  const posts = [...coursePosts, ...topics.flatMap((topic) => topic.posts)];
  await insertInBatches(posts, (batch) => db.insert(courseChatMessages).values(batch));
  await insertInBatches(buildReactions(tenant.id, posts, posterIds), (batch) =>
    db.insert(courseChatMessageReactions).values(batch),
  );

  console.log(
    `✅ ${origin}: ${topics.length} forum topics and ${courseIds.length} course discussions with ${posts.length} posts`,
  );
}

async function findUserIdsByEmail(tenantId: UUIDType, emails: string[]): Promise<UUIDType[]> {
  const foundUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), inArray(users.email, emails)));

  return foundUsers.map(({ id }) => id);
}

async function createParticipants(tenantId: UUIDType, emailSuffix: string): Promise<UUIDType[]> {
  const participantIds: UUIDType[] = [];

  for (let index = 1; index <= FORUM_SEED_PARTICIPANT_COUNT; index++) {
    const [participant] = await db
      .insert(users)
      .values({
        email: addEmailSuffix(`user+forum+${index}@example.com`, emailSuffix),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        tenantId,
      })
      .returning({ id: users.id });
    await assignSystemRoleToUser(db, participant.id, tenantId, SYSTEM_ROLE_SLUGS.STUDENT);
    participantIds.push(participant.id);
  }

  return participantIds;
}

async function enableDiscussionFeatures(tenantId: UUIDType) {
  await db
    .update(settings)
    .set({
      settings: sql`${settings.settings} || jsonb_build_object('forumEnabled', true, 'courseDiscussionsEnabled', true)`,
    })
    .where(and(eq(settings.tenantId, tenantId), isNull(settings.userId)));
}

async function createCourses(tenantId: UUIDType, authorId: UUIDType): Promise<UUIDType[]> {
  const language = SUPPORTED_LANGUAGES.EN;
  const [existingCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.tenantId, tenantId),
        sql`${categories.title}->>${categories.baseLanguage} = ${FORUM_SEED_CATEGORY}`,
      ),
    );
  const [category] = existingCategory
    ? [existingCategory]
    : await db
        .insert(categories)
        .values({
          title: localizedText(FORUM_SEED_CATEGORY),
          baseLanguage: language,
          availableLocales: [language],
          tenantId,
        })
        .returning({ id: categories.id });

  const seedCourses = Array.from({ length: getCourseCount() }, (_, courseIndex) => {
    const subject = FORUM_SEED_COURSE_SUBJECTS[courseIndex % FORUM_SEED_COURSE_SUBJECTS.length];
    const courseNumber = String(courseIndex + 1).padStart(3, "0");

    return {
      id: crypto.randomUUID(),
      title: localizedText(`${FORUM_SEED_COURSE_TITLE_PREFIX} ${courseNumber}: ${subject}`),
      description: localizedText(
        `Demo course for testing the ${subject.toLowerCase()} discussion.`,
      ),
      baseLanguage: language,
      availableLocales: [language],
      status: "published" as const,
      authorId,
      categoryId: category.id,
      tenantId,
    };
  });

  await insertInBatches(seedCourses, (batch) => db.insert(courses).values(batch));

  return seedCourses.map(({ id }) => id);
}

async function enrollUsers(tenantId: UUIDType, courseIds: UUIDType[], userIds: UUIDType[]) {
  const enrolledAt = faker.date.recent({ days: FORUM_SEED_ACTIVITY_DAYS_AGO }).toISOString();
  const enrollments = courseIds.flatMap((courseId) =>
    userIds.map((studentId) => ({
      studentId,
      courseId,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt,
      tenantId,
    })),
  );

  await insertInBatches(enrollments, (batch) =>
    db.insert(studentCourses).values(batch).onConflictDoNothing(),
  );
}

/** In a course every top-level message is its own thread, with replies under it. */
function buildCourseDiscussion(
  tenantId: UUIDType,
  courseId: UUIDType,
  posterIds: UUIDType[],
  isBusyCourse: boolean,
): ForumSeedPost[] {
  const messageCount = isBusyCourse
    ? FORUM_SEED_BUSY_COURSE_MESSAGES
    : faker.number.int(FORUM_SEED_MESSAGES_PER_COURSE);

  return Array.from({ length: messageCount }, (_, messageIndex) => {
    const hasReplies = faker.number.float({ min: 0, max: 1 }) < FORUM_SEED_REPLY_CHANCE;
    const replyCount = hasReplies ? faker.number.int(FORUM_SEED_REPLIES_PER_MESSAGE) : 0;
    const isDeleted = isBusyCourse && messageIndex === 0;

    return buildThreadPosts({
      tenantId,
      courseId,
      posterIds,
      replyCount: isDeleted ? Math.max(1, replyCount) : replyCount,
      isFirstPostDeleted: isDeleted,
    });
  }).flat();
}

function buildTopic(tenantId: UUIDType, posterIds: UUIDType[], topicIndex: number) {
  const isLongTopic = topicIndex === 0;
  const isClosedTopic = topicIndex === 1;
  const replyCount = isLongTopic
    ? FORUM_SEED_LONG_TOPIC_REPLIES
    : faker.number.int(FORUM_SEED_REPLIES_PER_TOPIC);
  const posts = buildThreadPosts({
    tenantId,
    courseId: null,
    posterIds,
    replyCount: isClosedTopic ? Math.max(1, replyCount) : replyCount,
    isFirstPostDeleted: isClosedTopic,
  });
  const curatedTitle = FORUM_SEED_TOPIC_TITLES[topicIndex];

  return {
    threadId: posts[0].threadId,
    title: curatedTitle ?? faker.lorem.sentence({ min: 3, max: 7 }),
    posts,
  };
}

/** The first post of a thread followed by its replies, in chronological order. */
function buildThreadPosts(params: {
  tenantId: UUIDType;
  courseId: UUIDType | null;
  posterIds: UUIDType[];
  replyCount: number;
  isFirstPostDeleted: boolean;
}): ForumSeedPost[] {
  const { tenantId, courseId, posterIds, replyCount, isFirstPostDeleted } = params;
  const threadId = crypto.randomUUID();
  const firstPostId = crypto.randomUUID();
  const startedAt = faker.date.recent({ days: FORUM_SEED_ACTIVITY_DAYS_AGO });
  const postTimes = [
    startedAt,
    ...(replyCount
      ? faker.date.betweens({ from: startedAt, to: new Date(), count: replyCount })
      : []),
  ];
  const lastPostTime = postTimes[postTimes.length - 1];

  return postTimes.map((postTime, postIndex) => {
    const isFirstPost = postIndex === 0;
    const createdAt = postTime.toISOString();

    return {
      id: isFirstPost ? firstPostId : crypto.randomUUID(),
      threadId,
      courseId,
      userId: faker.helpers.arrayElement(posterIds),
      content: isFirstPost ? faker.lorem.paragraph({ min: 1, max: 3 }) : faker.lorem.sentence(),
      parentMessageId: isFirstPost ? null : firstPostId,
      createdAt,
      updatedAt: createdAt,
      deletedAt: isFirstPost && isFirstPostDeleted ? lastPostTime.toISOString() : null,
      tenantId,
    };
  });
}

/** One thread row per first post; a thread's latest post sets its last activity. */
async function insertThreads(
  tenantId: UUIDType,
  scope: DiscussionScope,
  posts: ForumSeedPost[],
  titleByThreadId = new Map<UUIDType, string>(),
) {
  const lastActivityByThreadId = new Map(posts.map((post) => [post.threadId, post.createdAt]));
  const threads = posts
    .filter((post) => post.parentMessageId === null)
    .map((firstPost) => ({
      id: firstPost.threadId,
      scope,
      title: titleByThreadId.get(firstPost.threadId) ?? null,
      courseId: firstPost.courseId,
      createdByUserId: firstPost.userId,
      createdAt: firstPost.createdAt,
      updatedAt: lastActivityByThreadId.get(firstPost.threadId) ?? firstPost.createdAt,
      tenantId,
    }));

  await insertInBatches(threads, (batch) => db.insert(courseChatThreads).values(batch));
}

function buildReactions(tenantId: UUIDType, posts: ForumSeedPost[], posterIds: UUIDType[]) {
  return posts
    .filter(
      (post) =>
        !post.deletedAt && faker.number.float({ min: 0, max: 1 }) < FORUM_SEED_REACTION_CHANCE,
    )
    .flatMap((post) => {
      const reaction = faker.helpers.arrayElement(COURSE_CHAT_ALLOWED_REACTIONS);
      const reactingUserIds = sampleSize(posterIds, faker.number.int({ min: 1, max: 3 }));

      return reactingUserIds.map((userId) => ({
        messageId: post.id,
        courseId: post.courseId,
        userId,
        reaction,
        tenantId,
      }));
    });
}

async function insertInBatches<Row>(rows: Row[], insertBatch: (batch: Row[]) => Promise<unknown>) {
  for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
    await insertBatch(batch);
  }
}

/** Built in SQL so postgres-js does not encode the JSON object a second time, as a string. */
function localizedText(value: string) {
  return sql`json_build_object('en', ${value}::text)`;
}

function getCourseCount(): number {
  const requestedCount = Number(process.env.FORUM_SEED_COURSE_COUNT);

  return Number.isInteger(requestedCount) && requestedCount > 0
    ? requestedCount
    : FORUM_SEED_DEFAULT_COURSE_COUNT;
}

if (require.main === module) {
  seedForum()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Forum seeding failed:", error);
      process.exit(1);
    });
}

export default seedForum;
