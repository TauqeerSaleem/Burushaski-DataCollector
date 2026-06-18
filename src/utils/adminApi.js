const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

const TOKEN_KEY = "burushaski_admin_token";
const ADMIN_KEY = "burushaski_admin";

async function request(path, options = {}) {
  const token = getAdminToken();
  const headers = {
    ...(options.body instanceof Blob ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
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

function toQuery(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, value);
    }
  });

  return searchParams.toString();
}

export async function fetchAdminRecords(page = 1, pageSize = 50, filters = {}) {
  const query = toQuery({ page, pageSize, ...filters });
  return request(`/api/admin/records?${query}`);
}

export async function fetchAdminCorrections(filters = {}) {
  const query = toQuery(filters);
  return request(`/api/admin/corrections${query ? `?${query}` : ""}`);
}

export async function approvePromptCorrection(payload) {
  const data = await request("/api/admin/corrections/approve", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.review;
}

export async function exportAdminData(type) {
  const token = getAdminToken();
  const response = await fetch(`${API_BASE_URL}/api/admin/export/${encodeURIComponent(type)}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Admin export failed");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `project-yaaran-${type}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function fetchAdminPrompts() {
  const data = await request("/api/admin/prompts");
  return data.prompts || [];
}

export async function createPrompt(prompt) {
  const data = await request("/api/admin/prompts", {
    method: "POST",
    body: JSON.stringify(prompt),
  });

  return data.prompt;
}

export async function updatePrompt(id, prompt) {
  const data = await request(`/api/admin/prompts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(prompt),
  });

  return data.prompt;
}

export async function deactivatePrompt(id) {
  const data = await request(`/api/admin/prompts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  return data?.prompt || null;
}

export async function uploadPromptMedia(file) {
  const data = await request("/api/admin/prompt-media", {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "X-File-Name": file.name,
    },
    body: file,
  });

  return data.publicUrl;
}

export async function fetchResearchTasks() {
  const data = await request("/api/admin/research-tasks");
  return data.tasks || [];
}

export async function createResearchTask(task) {
  const data = await request("/api/admin/research-tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });

  return data.task;
}

export async function updateResearchTask(id, task) {
  const data = await request(`/api/admin/research-tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(task),
  });

  return data.task;
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
