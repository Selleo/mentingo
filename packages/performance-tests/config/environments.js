/**
 * Environment configuration for different deployment targets
 * All configuration values are read from environment variables
 */

function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

const environments = {
  local: {
    name: "Local Development",
    baseUrl: getEnvVar("API_BASE_URL", "http://localhost:3000"),
    webUrl: getEnvVar("WEB_BASE_URL", "http://localhost:8080"),
    timeout: parseInt(getEnvVar("REQUEST_TIMEOUT_MS", "30000")),
    insecureSkipTLSVerify: getEnvVar("TLS_SKIP_VERIFY", "true") === "true",
  },
  staging: {
    name: "Staging Environment",
    baseUrl: getEnvVar("API_BASE_URL", "http://localhost:3000"),
    webUrl: getEnvVar("WEB_BASE_URL", "http://localhost:8080"),
    timeout: parseInt(getEnvVar("REQUEST_TIMEOUT_MS", "60000")),
    insecureSkipTLSVerify: getEnvVar("TLS_SKIP_VERIFY", "false") === "true",
  },
  prod: {
    name: "Production Environment",
    baseUrl: getEnvVar("API_BASE_URL", "http://localhost:3000"),
    webUrl: getEnvVar("WEB_BASE_URL", "http://localhost:8080"),
    timeout: parseInt(getEnvVar("REQUEST_TIMEOUT_MS", "60000")),
    insecureSkipTLSVerify: getEnvVar("TLS_SKIP_VERIFY", "false") === "true",
  },
};

export function getEnvironment() {
  const env = __ENV.K6_ENVIRONMENT || "local";

  if (!environments[env]) {
    throw new Error(
      `Unknown environment: ${env}. Available: ${Object.keys(environments).join(", ")}`,
    );
  }

  return environments[env];
}

export function getEnvironmentConfig(envName) {
  return environments[envName] || environments.local;
}

// Build API endpoints from environment variables
export const apiEndpoints = {
  // Auth endpoints
  auth: {
    register: getEnvVar("AUTH_REGISTER_PATH", "/api/auth/register"),
    login: getEnvVar("AUTH_LOGIN_PATH", "/api/auth/login"),
    logout: getEnvVar("AUTH_LOGOUT_PATH", "/api/auth/logout"),
    refresh: getEnvVar("AUTH_REFRESH_PATH", "/api/auth/refresh"),
    currentUser: getEnvVar("AUTH_CURRENT_USER_PATH", "/api/auth/current-user"),
    forgotPassword: getEnvVar("AUTH_FORGOT_PASSWORD_PATH", "/api/auth/forgot-password"),
    resetPassword: getEnvVar("AUTH_RESET_PASSWORD_PATH", "/api/auth/reset-password"),
    createPassword: getEnvVar("AUTH_CREATE_PASSWORD_PATH", "/api/auth/create-password"),
    mfaSetup: getEnvVar("AUTH_MFA_SETUP_PATH", "/api/auth/mfa/setup"),
    mfaVerify: getEnvVar("AUTH_MFA_VERIFY_PATH", "/api/auth/mfa/verify"),
  },

  // Course endpoints
  course: {
    all: getEnvVar("COURSE_ALL_PATH", "/api/course/all"),
    availableCourses: getEnvVar("COURSE_AVAILABLE_PATH", "/api/course/available-courses"),
    studentCourses: getEnvVar("COURSE_STUDENT_PATH", "/api/course/get-student-courses"),
    contentCreatorCourses: getEnvVar("COURSE_CREATOR_PATH", "/api/course/content-creator-courses"),
    getCourseById: getEnvVar("COURSE_GET_BY_ID_PATH", "/api/course"),
    create: getEnvVar("COURSE_CREATE_PATH", "/api/course"),
    update: getEnvVar("COURSE_UPDATE_PATH", "/api/course/:id"),
    delete: getEnvVar("COURSE_DELETE_PATH", "/api/course/deleteCourse/:id"),
    enrollCourse: getEnvVar("COURSE_ENROLL_PATH", "/api/course/enroll-course"),
    courseStatistics: getEnvVar("COURSE_STATISTICS_PATH", "/api/course/:courseId/statistics"),
    averageQuizScore: getEnvVar(
      "COURSE_QUIZ_SCORE_PATH",
      "/api/course/:courseId/statistics/average-quiz-score",
    ),
    studentsProgress: getEnvVar(
      "COURSE_STUDENTS_PROGRESS_PATH",
      "/api/course/:courseId/statistics/students-progress",
    ),
    studentsQuizResults: getEnvVar(
      "COURSE_QUIZ_RESULTS_PATH",
      "/api/course/:courseId/statistics/students-quiz-results",
    ),
  },

  // Lesson endpoints
  lesson: {
    studentLessons: getEnvVar("LESSON_STUDENT_PATH", "/api/lesson/student-lessons"),
    getById: getEnvVar("LESSON_GET_BY_ID_PATH", "/api/lesson/:id"),
  },

  // Statistics endpoints
  statistics: {
    userStats: getEnvVar("STATISTICS_USER_PATH", "/api/statistics/user-stats"),
    stats: getEnvVar("STATISTICS_PATH", "/api/statistics/stats"),
  },

  // Health check
  health: getEnvVar("HEALTH_CHECK_PATH", "/api/healthcheck"),
};

export default environments;
