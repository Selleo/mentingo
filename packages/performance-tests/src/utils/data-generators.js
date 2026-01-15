/**
 * Test data generators and fixtures
 * All configuration from environment variables
 * Uses deterministic email patterns matching bulk-user-seed.ts
 * Format: user+{role}+{index}@example.com
 */

import { randomIntBetween, randomString } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

// Helper function to get environment variables
function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

const TEST_EMAIL_DOMAIN = getEnvVar("TEST_EMAIL_DOMAIN", "mentingo.local");

// Seeded user counts (must match what's in the database)
// These match the defaults in bulk-users-seed.ts
const SEEDED_USER_COUNTS = {
  students: parseInt(getEnvVar("SEEDED_STUDENT_COUNT", "1000")),
  admins: parseInt(getEnvVar("SEEDED_ADMIN_COUNT", "100")),
  creators: parseInt(getEnvVar("SEEDED_CREATOR_COUNT", "100")),
};

// Default password for seeded users (must match seeder)
const SEEDED_USER_PASSWORD = getEnvVar("SEEDED_USER_PASSWORD", "password");

/**
 * Generate deterministic email matching the seeder pattern
 * Format: user+{role}+{index}@example.com
 * @param {string} role - 'student', 'admin', or 'creator'
 * @param {number} index - User index (1-based)
 * @returns {string} Email address
 */
function generateDeterministicEmail(role, index) {
  const roleKey = role === "contentCreator" ? "creator" : role;
  return `user+${roleKey}+${index}@example.com`;
}

/**
 * Generate random email
 */
export function generateEmail(prefix = "user") {
  return `${prefix}_${randomString(8)}@${TEST_EMAIL_DOMAIN}`;
}

/**
 * Generate random user data
 */
export function generateUser() {
  const firstName = randomString(8);
  const lastName = randomString(8);

  return {
    firstName,
    lastName,
    email: generateEmail(`${firstName.toLowerCase()}_${lastName.toLowerCase()}`),
    password: `TestPass${randomIntBetween(100000, 999999)}!`,
  };
}

/**
 * Generate random course data
 */
export function generateCourse() {
  return {
    title: `Course ${randomString(10)}`,
    description: `Description for course with ${randomIntBetween(50, 500)} characters`,
    category: randomArrayElement(["programming", "languages", "business", "design"]),
    language: "en",
    isPublished: Math.random() > 0.5,
    hasCertificate: Math.random() > 0.7,
  };
}

/**
 * Generate random lesson data
 */
export function generateLesson() {
  return {
    title: `Lesson ${randomString(8)}`,
    description: `Lesson description with content`,
    order: randomIntBetween(1, 50),
  };
}

/**
 * Generate random quiz data
 */
export function generateQuiz() {
  return {
    title: `Quiz ${randomString(8)}`,
    description: "Test your knowledge",
    passingScore: randomIntBetween(50, 80),
    numberOfAttempts: randomIntBetween(1, 5),
  };
}

/**
 * Generate random AI interaction data
 */
export function generateAIPrompt() {
  const prompts = [
    "Explain the concept of API design",
    "What are the best practices for web development?",
    "How do you optimize database queries?",
    "What is the difference between REST and GraphQL?",
    "Explain microservices architecture",
  ];

  return randomArrayElement(prompts);
}

/**
 * Pick random element from array
 */
export function randomArrayElement(array) {
  return array[randomIntBetween(0, array.length - 1)];
}

/**
 * Generate realistic user journey data
 */
export function generateUserJourney() {
  return {
    user: generateUser(),
    course: generateCourse(),
    lesson: generateLesson(),
    aiPrompt: generateAIPrompt(),
    courseEnrollmentTime: randomIntBetween(1000, 10000),
    lessonViewTime: randomIntBetween(5000, 30000),
  };
}

/**
 * Generate batch of test data
 */
export function generateBatch(count, generator) {
  const results = [];

  for (let i = 0; i < count; i++) {
    results.push(generator());
  }

  return results;
}

// Fallback test users (used if deterministic users not available)
const fallbackTestUsers = {
  student: {
    email: __ENV.TEST_USER_EMAIL || "user@example.com",
    password: __ENV.TEST_USER_PASSWORD || "password",
    role: "STUDENT",
  },
  admin: {
    email: __ENV.TEST_ADMIN_EMAIL || "admin@example.com",
    password: __ENV.TEST_ADMIN_PASSWORD || "password",
    role: "ADMIN",
  },
  contentCreator: {
    email: __ENV.TEST_CREATOR_EMAIL || "contentcreator@example.com",
    password: __ENV.TEST_CREATOR_PASSWORD || "password",
    role: "CONTENT_CREATOR",
  },
};

export const testUsers = fallbackTestUsers;

/**
 * Get a random user from seeded users using deterministic email pattern
 * @param {string} role - 'student', 'admin', or 'contentCreator'
 * @returns {object} User object with email, password, role, etc.
 */
export function getTestUser(role = "student") {
  // Map role to count key
  const roleKey = role === "contentCreator" ? "creators" : `${role}s`;
  const count = SEEDED_USER_COUNTS[roleKey];

  if (count && count > 0) {
    // Generate random index (1-based to match seeder)
    const index = randomIntBetween(1, count);
    const email = generateDeterministicEmail(role, index);

    return {
      email: email,
      password: SEEDED_USER_PASSWORD,
      role: role === "contentCreator" ? "CONTENT_CREATOR" : role.toUpperCase(),
    };
  }

  // Fallback to default test user
  const roleKey2 = role === "contentCreator" ? "contentCreator" : role;
  return fallbackTestUsers[roleKey2] || fallbackTestUsers.student;
}

/**
 * Get a specific user by index from seeded users (deterministic)
 * @param {string} role - 'student', 'admin', or 'contentCreator'
 * @param {number} index - Index of the user (1-based to match seeder)
 * @returns {object} User object
 */
export function getSeededUser(role = "student", index = 1) {
  const roleKey = role === "contentCreator" ? "creators" : `${role}s`;
  const count = SEEDED_USER_COUNTS[roleKey];

  if (count && count > 0) {
    // Ensure index is within valid range (1 to count)
    const safeIndex = ((index - 1) % count) + 1;
    const email = generateDeterministicEmail(role, safeIndex);

    return {
      email: email,
      password: SEEDED_USER_PASSWORD,
      role: role === "contentCreator" ? "CONTENT_CREATOR" : role.toUpperCase(),
    };
  }

  return getTestUser(role);
}

/**
 * Get all seeded user emails of a specific role (for reference)
 * Note: This doesn't return actual user objects, just shows the pattern
 * @param {string} role - 'student', 'admin', or 'contentCreator'
 * @returns {array} Array of email strings
 */
export function getAllSeededUsers(role = "student") {
  const roleKey = role === "contentCreator" ? "creators" : `${role}s`;
  const count = SEEDED_USER_COUNTS[roleKey];
  const emails = [];

  if (count && count > 0) {
    for (let i = 1; i <= count; i++) {
      emails.push(generateDeterministicEmail(role, i));
    }
  }

  return emails;
}

export default {
  generateEmail,
  generateUser,
  generateCourse,
  generateLesson,
  generateQuiz,
  generateAIPrompt,
  randomArrayElement,
  generateUserJourney,
  generateBatch,
  testUsers,
  getTestUser,
  getSeededUser,
  getAllSeededUsers,
};
