const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

const TOKEN_KEY = "burushaski_admin_token";
const ADMIN_KEY = "burushaski_admin";

async function request(path, options = {}) {
  const token = getAdminToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Admin request failed");
  }

  return data;
}

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSavedAdmin() {
  const saved = localStorage.getItem(ADMIN_KEY);

  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    clearAdminSession();
    return null;
  }
}

export function saveAdminSession(admin, token) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export async function adminLogin(credentials) {
  const data = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  saveAdminSession(data.admin, data.token);
  return data.admin;
}

export async function fetchAdminSession() {
  const data = await request("/api/admin/session");
  return data.admin;
}

export async function fetchAdminOverview() {
  const data = await request("/api/admin/overview");
  return data;
}

export async function fetchAdminUsers() {
  const data = await request("/api/admin/users");
  return data.users || [];
}

export async function updateAdminUser(id, profile) {
  const data = await request(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(profile),
  });

  return data.user;
}

export async function deleteAdminUser(id) {
  await request(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchAdminData() {
  return request("/api/admin/data");
}

export async function fetchAdmins() {
  const data = await request("/api/admin/admins");
  return data.admins || [];
}

export async function createAdminAccount(profile) {
  const data = await request("/api/admin/admins", {
    method: "POST",
    body: JSON.stringify(profile),
  });

  return data.admin;
}

export async function updateAdminAccount(id, profile) {
  const data = await request(`/api/admin/admins/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(profile),
  });

  return data.admin;
}

export async function deleteAdminAccount(id) {
  await request(`/api/admin/admins/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
