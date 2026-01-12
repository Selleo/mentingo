import http from "k6/http";
import { check, sleep } from "k6";
import { getEnvironment, apiEndpoints } from "../../config/environments.js";

const env = getEnvironment();

// Store for auth tokens
let authTokens = {
  student: null,
  admin: null,
  contentCreator: null,
};

function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000; // Convert to milliseconds
  } catch (e) {
    return null;
  }
}

export function loginUser(email, password, userType = "student") {
  const loginUrl = `${env.baseUrl}${apiEndpoints.auth.login}`;

  const payload = JSON.stringify({
    email,
    password,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = http.post(loginUrl, payload, params);

  // Extract tokens from response or cookies
  // Accept both 200 and 201 as successful login
  if (response.status === 200 || response.status === 201) {
    const body = response.json();

    // Store token info (actual tokens are in HTTP-only cookies managed by k6's jar)
    authTokens[userType] = {
      access: "cookie-based",
      refresh: "cookie-based",
      expiresAt: null,
    };

    check(response, {
      "login successful": (r) => r.status === 200 || r.status === 201,
      "has user data": (r) => !!body.data?.id || !!body.id,
    });

    return {
      success: true,
      tokens: authTokens[userType],
      response,
    };
  } else {
    check(response, {
      "login successful": (r) => false,
    });

    return {
      success: false,
      error: response.body,
      response,
    };
  }
}

export function getAccessToken(userType = "student") {
  const tokens = authTokens[userType];

  if (!tokens) {
    throw new Error(`No tokens stored for user type: ${userType}`);
  }

  const now = Date.now();
  const buffer = 60000; // 1 minute

  if (tokens.expiresAt && tokens.expiresAt - now < buffer) {
    refreshAccessToken(userType);
  }

  return tokens.access;
}

export function refreshAccessToken(userType = "student") {
  const tokens = authTokens[userType];

  if (!tokens?.refresh) {
    throw new Error(`No refresh token available for: ${userType}`);
  }

  const refreshUrl = `${env.baseUrl}${apiEndpoints.auth.refresh}`;

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = http.post(refreshUrl, "{}", params);

  if (response.status === 200) {
    check(response, {
      "token refresh successful": (r) => r.status === 200,
    });
  }

  return response;
}

export function getAuthHeaders(userType = "student") {
  return {
    "Content-Type": "application/json",
  };
}

export function authenticatedRequest(method, url, payload = null, userType = "student") {
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  let response;

  switch (method.toUpperCase()) {
    case "GET":
      response = http.get(url, params);
      break;
    case "POST":
      response = http.post(url, payload, params);
      break;
    case "PATCH":
      response = http.patch(url, payload, params);
      break;
    case "PUT":
      response = http.put(url, payload, params);
      break;
    case "DELETE":
      response = http.delete(url, params);
      break;
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }

  // Log unexpected failures (exclude expected errors like 409 for already-enrolled courses)
  if (response.status >= 500 || (response.status >= 400 && response.status !== 409)) {
    console.error(`[FAILED] ${method} ${url} returned status ${response.status}`);
    try {
      const body = response.json();
      console.error(`[ERROR DETAILS] ${JSON.stringify(body)}`);
    } catch (e) {
      console.error(`[ERROR BODY] ${response.body}`);
    }
  }

  return response;
}

export function logoutUser(userType = "student") {
  const logoutUrl = `${env.baseUrl}${apiEndpoints.auth.logout}`;

  const response = authenticatedRequest("POST", logoutUrl, "{}", userType);

  if (response.status === 200 || response.status === 201 || response.status === 204) {
    authTokens[userType] = null;
  }

  check(response, {
    "logout successful": (r) => r.status === 200 || r.status === 201 || r.status === 204,
  });

  return response;
}

export function getCurrentUser(userType = "student") {
  const url = `${env.baseUrl}${apiEndpoints.auth.currentUser}`;
  console.log(`Getting current user from ${url}`);

  const response = authenticatedRequest("GET", url, null, userType);

  console.log(
    `Current user response: status=${response.status}, hasData=${!!response.json()?.data}`,
  );

  check(response, {
    "get current user successful": (r) => r.status === 200,
    "has user data": (r) => !!r.json()?.data?.id,
  });

  return response;
}

export function setupUserSession(email, password, userType = "student") {
  const result = loginUser(email, password, userType);

  if (!result.success) {
    throw new Error(`Failed to setup session for ${userType}: ${result}`);
  }

  return result;
}

export function clearAuthData() {
  authTokens = {
    student: null,
    admin: null,
    contentCreator: null,
  };
}

export default {
  loginUser,
  getAccessToken,
  refreshAccessToken,
  getAuthHeaders,
  authenticatedRequest,
  logoutUser,
  getCurrentUser,
  setupUserSession,
  clearAuthData,
};
