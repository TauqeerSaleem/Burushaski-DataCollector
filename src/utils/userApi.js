import { normalizeUserRole } from "./roles";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(error) {
  return error instanceof TypeError || error?.name === "AbortError";
}

async function request(path, options = {}) {
  const { retries = 0, ...fetchOptions } = options;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestOnce(path, fetchOptions);
    } catch (error) {
      if (attempt >= retries || !isNetworkError(error)) {
        throw error;
      }

      await delay(400 * (attempt + 1));
    }
  }
}

async function requestOnce(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function normalizeApiUser(user) {
  return {
    ...user,
    role: normalizeUserRole(user?.role),
  };
}

export async function checkUsernameAvailable(username) {
  const data = await request(`/api/users/check-username/${encodeURIComponent(username)}`, {
    method: "GET",
  });
  return data.available;
}

export async function signupUser(profile) {
  const data = await request("/api/users/signup", {
    method: "POST",
    body: JSON.stringify(profile),
    retries: 1,
  });

  return normalizeApiUser(data.user);
}

export async function loginUser(username) {
  const data = await request("/api/users/login", {
    method: "POST",
    body: JSON.stringify({ username }),
    retries: 2,
  });

  return normalizeApiUser(data.user);
}

export async function updateUserProfile(username, profile) {
  const data = await request(`/api/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: JSON.stringify(profile),
  });

  return normalizeApiUser(data.user);
}

export async function createContribution(contribution) {
  const data = await request("/api/contributions", {
    method: "POST",
    body: JSON.stringify(contribution),
  });

  return data.contribution;
}

export async function getUserContributions(username) {
  const data = await request(`/api/contributions/${encodeURIComponent(username)}`, {
    method: "GET",
    retries: 1,
  });

  return data.contributions || [];
}
