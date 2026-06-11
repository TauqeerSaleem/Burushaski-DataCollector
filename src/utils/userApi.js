import { normalizeUserRole } from "./roles";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

async function request(path, options = {}) {
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

export async function signupUser(profile) {
  const data = await request("/api/users/signup", {
    method: "POST",
    body: JSON.stringify(profile),
  });

  return normalizeApiUser(data.user);
}

export async function loginUser(username) {
  const data = await request("/api/users/login", {
    method: "POST",
    body: JSON.stringify({ username }),
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
