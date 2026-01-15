import http from "k6/http";
import { group, check, sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { getEnvironment, apiEndpoints } from "../../config/environments.js";
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  refreshAccessToken,
  setupUserSession,
  clearAuthData,
} from "../utils/auth.js";
import {
  checkAuthResponse,
  checkSuccessResponse,
  checkResourceResponse,
  checkAllEndpoints,
} from "../utils/check-helpers.js";
import { getTestUser } from "../utils/data-generators.js";

const env = getEnvironment();

function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

export function authenticationTests(role = "student") {
  group("Authentication Endpoints", () => {
    const testUser = getTestUser(role);

    group("Login Flow", () => {
      const loginUrl = `${env.baseUrl}${apiEndpoints.auth.login}`;

      const payload = JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      });

      const params = {
        headers: {
          "Content-Type": "application/json",
        },
      };

      const response = http.post(loginUrl, payload, params);

      check(response, {
        "login successful": (r) => r.status === 200 || r.status === 201,
        "login response has user info": (r) => {
          const body = r.json();
          return !!body.data?.user || !!body.data?.email || !!body.data?.id;
        },
        "response time acceptable": (r) => r.timings.duration < 1000,
      });
    });

    // Setup for subsequent auth tests
    const setupResult = setupUserSession(testUser.email, testUser.password, role);
    if (!setupResult.success) {
      return; // Skip remaining tests if login fails
    }

    sleep(randomIntBetween(1, 3));

    group("Get Current User", () => {
      console.log(`[Test] Getting current user for ${testUser.email} (role: ${role})`);
      const response = getCurrentUser(role);

      console.log(`[Test] Current user response status: ${response.status}`);

      checkResourceResponse(response, ["id", "email", "role"]);
      checkAllEndpoints(response, {
        expectedStatus: 200,
        maxResponseTime: 500,
      });

      check(response, {
        "current user has email": (r) => r.json()?.data?.email === testUser.email,
        "current user has role": (r) => !!r.json()?.data?.role,
      });
    });

    sleep(randomIntBetween(1, 2));

    group("Refresh Token", () => {
      const response = refreshAccessToken(role);

      check(response, {
        "refresh successful": (r) => r.status === 200 || r.status === 201 || r.status === 204,
        "response time acceptable": (r) => r.timings.duration < 500,
      });
    });

    sleep(randomIntBetween(1, 2));

    group("Logout", () => {
      const response = logoutUser(role);

      check(response, {
        "logout successful": (r) => r.status === 200 || r.status === 201 || r.status === 204,
      });
    });

    // Clean up
    clearAuthData();
  });
}

export function adminAuthenticationTests() {
  group("Admin Authentication", () => {
    const testAdmin = getTestUser("admin");

    const loginUrl = `${env.baseUrl}${apiEndpoints.auth.login}`;

    const payload = JSON.stringify({
      email: testAdmin.email,
      password: testAdmin.password,
    });

    const params = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = http.post(loginUrl, payload, params);

    check(response, {
      "admin login successful": (r) => r.status === 200,
      "admin user has ADMIN role": (r) => {
        const body = r.json();
        return body.data?.user?.role === "ADMIN" || body.data?.role === "ADMIN";
      },
    });

    checkAuthResponse(response);
  });
}

export function contentCreatorAuthenticationTests() {
  group("Content Creator Authentication", () => {
    const testCreator = getTestUser("contentCreator");

    const loginUrl = `${env.baseUrl}${apiEndpoints.auth.login}`;

    const payload = JSON.stringify({
      email: testCreator.email,
      password: testCreator.password,
    });

    const params = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = http.post(loginUrl, payload, params);

    check(response, {
      "creator login successful": (r) => r.status === 200,
      "creator has CONTENT_CREATOR role": (r) => {
        const body = r.json();
        return body.data?.user?.role === "CONTENT_CREATOR" || body.data?.role === "CONTENT_CREATOR";
      },
    });

    checkAuthResponse(response);
  });
}

export function failedAuthenticationTests() {
  group("Failed Authentication Attempts", () => {
    const loginUrl = `${env.baseUrl}${apiEndpoints.auth.login}`;

    group("Wrong password", () => {
      const payload = JSON.stringify({
        email: getTestUser("student").email,
        password: "WrongPassword123!",
      });

      const params = {
        headers: {
          "Content-Type": "application/json",
        },
      };

      const response = http.post(loginUrl, payload, params);

      check(response, {
        "login rejected": (r) => r.status === 401 || r.status === 400,
      });
    });

    sleep(0.5);

    group("Non-existent user", () => {
      const payload = JSON.stringify({
        email: getEnvVar("FAILED_LOGIN_EMAIL", "nonexistent@mentingo.local"),
        password: "SomePassword123!",
      });

      const params = {
        headers: {
          "Content-Type": "application/json",
        },
      };

      const response = http.post(loginUrl, payload, params);

      check(response, {
        "login rejected": (r) => r.status === 401 || r.status === 400 || r.status === 404,
      });
    });
  });
}

export default {
  authenticationTests,
  adminAuthenticationTests,
  contentCreatorAuthenticationTests,
  failedAuthenticationTests,
};
