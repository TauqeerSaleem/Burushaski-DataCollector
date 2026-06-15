import express from "express";
import { hasServiceRoleKey, hasSupabaseConfig, supabase } from "../supabaseClient.js";
import { normalizeUserRole, USER_ROLES } from "../utils/roles.js";
import {
  createAdminToken,
  getBearerToken,
  hashPassword,
  hasMasterAdminPassword,
  isMasterAdminUsername,
  masterAdminUsername,
  verifyAdminToken,
  verifyMasterAdmin,
  verifyPassword,
} from "../utils/adminAuth.js";

const router = express.Router();
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const loginAttempts = new Map();

function requireServiceRole(res) {
  if (!hasSupabaseConfig || !supabase) {
    res.status(500).json({ error: "Admin API requires Supabase backend environment variables." });
    return false;
  }

  if (hasServiceRoleKey) return true;

  res.status(500).json({ error: "Admin API requires SUPABASE_SERVICE_ROLE_KEY." });
  return false;
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function cleanOptionalText(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function cleanArray(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(",");
  return items.map(cleanText).filter(Boolean);
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function requireAdmin(req, res, next) {
  try {
    const admin = verifyAdminToken(getBearerToken(req));

    if (!admin) {
      return res.status(401).json({ error: "Admin login required." });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function loginAttemptKey(req, username) {
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${String(username || "").toLowerCase()}`;
}

function isLoginLimited(req, username) {
  const key = loginAttemptKey(req, username);
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || attempt.resetAt < now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordLoginFailure(req, username) {
  const key = loginAttemptKey(req, username);
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };

  loginAttempts.set(key, {
    count: attempt.count + 1,
    resetAt: attempt.resetAt > now ? attempt.resetAt : now + LOGIN_WINDOW_MS,
  });
}

function clearLoginFailures(req, username) {
  loginAttempts.delete(loginAttemptKey(req, username));
}

function adminAccountToClient(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || "",
    active: Boolean(row.active),
    isMaster: false,
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function masterAdminToClient() {
  return {
    id: "master",
    username: masterAdminUsername(),
    displayName: "Master Admin",
    active: hasMasterAdminPassword(),
    isMaster: true,
    protected: true,
    createdBy: "environment",
  };
}

function userToClient(row) {
  return {
    id: row.id,
    participantId: row.participant_id,
    username: row.username,
    role: normalizeUserRole(row.role),
    name: row.display_name || "",
    contactPreference: row.contact_preference || "",
    mobileNumber: row.mobile_number || "",
    dialect: row.dialect || "",
    dialects: row.dialects || [],
    otherDialect: row.other_dialect || "",
    gender: row.gender || "",
    age: row.age || "",
    otherLanguageCount: row.other_language_count || "",
    otherLanguages: row.other_languages || [],
    comfortLanguage: row.comfort_language || "",
    placeOfBirth: row.place_of_birth || "",
    placesLived: row.places_lived || [],
    consentAccepted: Boolean(row.consent_accepted),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userUpdatePayload(body) {
  const role = body.role ? normalizeUserRole(body.role) : undefined;

  return {
    ...(role ? { role } : {}),
    ...(body.name !== undefined || body.displayName !== undefined
      ? { display_name: cleanText(body.name || body.displayName) }
      : {}),
    ...(body.contactPreference !== undefined
      ? { contact_preference: cleanText(body.contactPreference) }
      : {}),
    ...(body.mobileNumber !== undefined ? { mobile_number: cleanText(body.mobileNumber) } : {}),
    ...(body.dialect !== undefined ? { dialect: cleanText(body.dialect) } : {}),
    ...(body.dialects !== undefined ? { dialects: cleanArray(body.dialects) } : {}),
    ...(body.otherDialect !== undefined ? { other_dialect: cleanText(body.otherDialect) } : {}),
    ...(body.gender !== undefined ? { gender: cleanText(body.gender) } : {}),
    ...(body.age !== undefined ? { age: cleanText(body.age) } : {}),
    ...(body.otherLanguageCount !== undefined
      ? { other_language_count: cleanText(body.otherLanguageCount) }
      : {}),
    ...(body.otherLanguages !== undefined ? { other_languages: cleanArray(body.otherLanguages) } : {}),
    ...(body.comfortLanguage !== undefined
      ? { comfort_language: cleanText(body.comfortLanguage) }
      : {}),
    ...(body.placeOfBirth !== undefined ? { place_of_birth: cleanText(body.placeOfBirth) } : {}),
    ...(body.placesLived !== undefined ? { places_lived: cleanArray(body.placesLived) } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    updated_at: new Date().toISOString(),
  };
}

function promptToClient(row) {
  return {
    id: row.id,
    promptId: row.prompt_id,
    moduleId: row.module_id,
    moduleTitle: row.module_title,
    promptType: row.prompt_type,
    dialect: row.dialect || "",
    english: row.english || "",
    transliteration: row.transliteration || "",
    mediaUrl: row.media_url || "",
    difficulty: row.difficulty || "short",
    curriculumStage: row.curriculum_stage || "",
    grammaticalCategory: row.grammatical_category || "",
    weight: row.weight || 0,
    active: row.active !== false,
    sortOrder: row.sort_order || 0,
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function promptPayload(body, admin) {
  const english = cleanText(body.english);

  return {
    ...(body.promptId !== undefined ? { prompt_id: cleanText(body.promptId) } : {}),
    ...(body.moduleId !== undefined ? { module_id: cleanText(body.moduleId) || "admin-prompts" } : {}),
    ...(body.moduleTitle !== undefined ? { module_title: cleanText(body.moduleTitle) || "Admin Prompts" } : {}),
    ...(body.promptType !== undefined ? { prompt_type: cleanText(body.promptType) || "translation" } : {}),
    ...(body.dialect !== undefined ? { dialect: cleanText(body.dialect) } : {}),
    ...(body.english !== undefined ? { english } : {}),
    ...(body.transliteration !== undefined ? { transliteration: cleanText(body.transliteration) } : {}),
    ...(body.mediaUrl !== undefined ? { media_url: cleanText(body.mediaUrl) } : {}),
    ...(body.difficulty !== undefined ? { difficulty: cleanText(body.difficulty) || "short" } : {}),
    ...(body.curriculumStage !== undefined ? { curriculum_stage: cleanText(body.curriculumStage) } : {}),
    ...(body.grammaticalCategory !== undefined ? { grammatical_category: cleanText(body.grammaticalCategory) } : {}),
    ...(body.weight !== undefined ? { weight: cleanNumber(body.weight, 1) } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    ...(body.sortOrder !== undefined ? { sort_order: cleanNumber(body.sortOrder, 0) } : {}),
    ...(admin ? { created_by: admin.username } : {}),
    updated_at: new Date().toISOString(),
  };
}

function taskToClient(row) {
  return {
    id: row.id,
    title: row.title || "",
    taskType: row.task_type || "transcription",
    assignedTo: row.assigned_to || "",
    sourceType: row.source_type || "audio",
    sourceRef: row.source_ref || "",
    sourceText: row.source_text || "",
    instructions: row.instructions || "",
    status: row.status || "todo",
    priority: row.priority || "normal",
    dueDate: row.due_date || "",
    transcript: row.transcript || "",
    translation: row.translation || "",
    notes: row.notes || "",
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskPayload(body, admin) {
  return {
    ...(body.title !== undefined ? { title: cleanText(body.title) } : {}),
    ...(body.taskType !== undefined ? { task_type: cleanText(body.taskType) || "transcription" } : {}),
    ...(body.assignedTo !== undefined ? { assigned_to: cleanText(body.assignedTo) } : {}),
    ...(body.sourceType !== undefined ? { source_type: cleanText(body.sourceType) || "audio" } : {}),
    ...(body.sourceRef !== undefined ? { source_ref: cleanText(body.sourceRef) } : {}),
    ...(body.sourceText !== undefined ? { source_text: cleanText(body.sourceText) } : {}),
    ...(body.instructions !== undefined ? { instructions: cleanText(body.instructions) } : {}),
    ...(body.status !== undefined ? { status: cleanText(body.status) || "todo" } : {}),
    ...(body.priority !== undefined ? { priority: cleanText(body.priority) || "normal" } : {}),
    ...(body.dueDate !== undefined ? { due_date: cleanText(body.dueDate) } : {}),
    ...(body.transcript !== undefined ? { transcript: cleanText(body.transcript) } : {}),
    ...(body.translation !== undefined ? { translation: cleanText(body.translation) } : {}),
    ...(body.notes !== undefined ? { notes: cleanText(body.notes) } : {}),
    ...(admin ? { created_by: admin.username } : {}),
    updated_at: new Date().toISOString(),
  };
}

function promptsToModules(rows) {
  const modules = new Map();

  rows.forEach((row) => {
    const moduleId = row.module_id || "admin-prompts";
    if (!modules.has(moduleId)) {
      modules.set(moduleId, {
        moduleId,
        title: row.module_title || "Admin Prompts",
        sentences: [],
      });
    }

    modules.get(moduleId).sentences.push({
      sentenceId: row.prompt_id,
      english: row.english,
      transliteration: row.transliteration || row.english,
      promptType: row.prompt_type,
      mediaUrl: row.media_url || "",
      grammaticalCategory: row.grammatical_category || "",
      weight: row.weight || 1,
    });
  });

  return { modules: Array.from(modules.values()) };
}

async function writeActivity(admin, action, targetType, targetId, details = {}) {
  await supabase.from("admin_activity_logs").insert({
    admin_username: admin.username,
    admin_is_master: Boolean(admin.isMaster),
    action,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    details,
  });
}

router.get("/prompts", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const dialect = cleanText(req.query.dialect);
    let query = supabase
      .from("prompt_bank")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (dialect) {
      query = query.or(`dialect.is.null,dialect.eq.${dialect}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(promptsToModules(data || []));
  } catch (error) {
    console.error("Public prompts failed:", error.message);
    res.status(500).json({ error: "Unable to load prompts." });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const username = cleanText(req.body.username);
    const password = cleanOptionalText(req.body.password);

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    if (isLoginLimited(req, username)) {
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }

    if (isMasterAdminUsername(username) && !hasMasterAdminPassword()) {
      return res.status(503).json({ error: "Master admin is not configured on this deployment." });
    }

    if (verifyMasterAdmin(username, password)) {
      const admin = {
        id: "master",
        username: masterAdminUsername(),
        displayName: "Master Admin",
        isMaster: true,
      };
      const token = createAdminToken(admin);

      await writeActivity(admin, "login", "admin", "master");
      clearLoginFailures(req, username);
      return res.json({ admin, token });
    }

    const { data: account, error } = await supabase
      .from("admin_accounts")
      .select("*")
      .eq("username", username)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;

    if (!account || !verifyPassword(password, account.password_hash)) {
      recordLoginFailure(req, username);
      return res.status(401).json({ error: "Invalid admin credentials." });
    }

    const admin = {
      id: account.id,
      username: account.username,
      displayName: account.display_name || account.username,
      isMaster: false,
    };
    const token = createAdminToken(admin);

    await supabase
      .from("admin_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", account.id);
    await writeActivity(admin, "login", "admin", account.id);
    clearLoginFailures(req, username);

    return res.json({ admin, token });
  } catch (error) {
    console.error("Admin login failed:", error.message);
    return res.status(500).json({ error: "Unable to log in admin." });
  }
});

router.get("/admin/session", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

router.get("/admin/overview", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const [
      usersResult,
      recordingsResult,
      feedbackResult,
      subscriptionsResult,
      logsResult,
    ] = await Promise.all([
      supabase.from("app_users").select("role, dialect, gender, created_at"),
      supabase.from("recordings").select("participant_id, module_id, sentence_id, created_at"),
      supabase.from("feedback").select("participant_id, created_at"),
      supabase.from("push_subscriptions").select("participant_id, updated_at"),
      supabase.from("notification_logs").select("status, sent_at"),
    ]);

    const errors = [usersResult, recordingsResult, feedbackResult, subscriptionsResult, logsResult]
      .map((result) => result.error)
      .filter(Boolean);

    if (errors.length) throw errors[0];

    const users = usersResult.data || [];
    const recordings = recordingsResult.data || [];
    const feedback = feedbackResult.data || [];

    const countBy = (rows, key) =>
      rows.reduce((map, row) => {
        const value = row[key] || "unknown";
        map[value] = (map[value] || 0) + 1;
        return map;
      }, {});

    res.json({
      totals: {
        users: users.length,
        recordings: recordings.length,
        feedback: feedback.length,
        pushSubscriptions: subscriptionsResult.data?.length || 0,
        notificationLogs: logsResult.data?.length || 0,
      },
      usersByRole: countBy(users, "role"),
      usersByDialect: countBy(users, "dialect"),
      usersByGender: countBy(users, "gender"),
      recordingsByModule: countBy(recordings, "module_id"),
      recentUsers: users.slice(-8).reverse(),
      recentRecordings: recordings.slice(-8).reverse(),
      recentFeedback: feedback.slice(-8).reverse(),
    });
  } catch (error) {
    console.error("Admin overview failed:", error.message);
    res.status(500).json({ error: "Unable to load admin overview." });
  }
});

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ users: (data || []).map(userToClient) });
  } catch (error) {
    console.error("Admin users failed:", error.message);
    res.status(500).json({ error: "Unable to load users." });
  }
});

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const payload = userUpdatePayload(req.body);

    const { data, error } = await supabase
      .from("app_users")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "User not found." });

    await writeActivity(req.admin, "update_user", "user", req.params.id, payload);
    res.json({ user: userToClient(data) });
  } catch (error) {
    console.error("Admin user update failed:", error.message);
    res.status(500).json({ error: "Unable to update user." });
  }
});

router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data, error } = await supabase
      .from("app_users")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "User not found." });

    await writeActivity(req.admin, "deactivate_user", "user", req.params.id);
    res.json({ user: userToClient(data) });
  } catch (error) {
    console.error("Admin user deactivate failed:", error.message);
    res.status(500).json({ error: "Unable to deactivate user." });
  }
});

router.get("/admin/data", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const [recordings, feedback, subscriptions, notificationLogs, activityLogs] = await Promise.all([
      supabase.from("recordings").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("push_subscriptions").select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("notification_logs").select("*").order("sent_at", { ascending: false }).limit(200),
      supabase.from("admin_activity_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    const error = [recordings, feedback, subscriptions, notificationLogs, activityLogs]
      .map((result) => result.error)
      .find(Boolean);

    if (error) throw error;

    res.json({
      recordings: recordings.data || [],
      feedback: feedback.data || [],
      subscriptions: subscriptions.data || [],
      notificationLogs: notificationLogs.data || [],
      activityLogs: activityLogs.data || [],
    });
  } catch (error) {
    console.error("Admin data failed:", error.message);
    res.status(500).json({ error: "Unable to load data." });
  }
});

router.get("/admin/prompts", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data, error } = await supabase
      .from("prompt_bank")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ prompts: (data || []).map(promptToClient) });
  } catch (error) {
    console.error("Admin prompts failed:", error.message);
    res.status(500).json({ error: "Unable to load prompts." });
  }
});

router.post("/admin/prompts", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const payload = promptPayload(req.body, req.admin);

    if (!payload.prompt_id || !payload.english) {
      return res.status(400).json({ error: "Prompt ID and English prompt are required." });
    }

    const { data, error } = await supabase
      .from("prompt_bank")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    await writeActivity(req.admin, "create_prompt", "prompt", data.id, { promptId: data.prompt_id });
    res.status(201).json({ prompt: promptToClient(data) });
  } catch (error) {
    console.error("Admin prompt create failed:", error.message);
    res.status(500).json({ error: "Unable to create prompt." });
  }
});

router.patch("/admin/prompts/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const payload = promptPayload(req.body);
    delete payload.created_by;

    const { data, error } = await supabase
      .from("prompt_bank")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Prompt not found." });

    await writeActivity(req.admin, "update_prompt", "prompt", req.params.id);
    res.json({ prompt: promptToClient(data) });
  } catch (error) {
    console.error("Admin prompt update failed:", error.message);
    res.status(500).json({ error: "Unable to update prompt." });
  }
});

router.delete("/admin/prompts/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data, error } = await supabase
      .from("prompt_bank")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Prompt not found." });

    await writeActivity(req.admin, "deactivate_prompt", "prompt", req.params.id);
    res.json({ prompt: promptToClient(data) });
  } catch (error) {
    console.error("Admin prompt deactivate failed:", error.message);
    res.status(500).json({ error: "Unable to deactivate prompt." });
  }
});

router.get("/admin/research-tasks", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data, error } = await supabase
      .from("research_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ tasks: (data || []).map(taskToClient) });
  } catch (error) {
    console.error("Admin research tasks failed:", error.message);
    res.status(500).json({ error: "Unable to load research tasks." });
  }
});

router.post("/admin/research-tasks", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const payload = taskPayload(req.body, req.admin);

    if (!payload.title) {
      return res.status(400).json({ error: "Task title is required." });
    }

    const { data, error } = await supabase
      .from("research_tasks")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    await writeActivity(req.admin, "create_research_task", "research_task", data.id);
    res.status(201).json({ task: taskToClient(data) });
  } catch (error) {
    console.error("Admin research task create failed:", error.message);
    res.status(500).json({ error: "Unable to create research task." });
  }
});

router.patch("/admin/research-tasks/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const payload = taskPayload(req.body);
    delete payload.created_by;

    const { data, error } = await supabase
      .from("research_tasks")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Research task not found." });

    await writeActivity(req.admin, "update_research_task", "research_task", req.params.id);
    res.json({ task: taskToClient(data) });
  } catch (error) {
    console.error("Admin research task update failed:", error.message);
    res.status(500).json({ error: "Unable to update research task." });
  }
});

router.get("/admin/admins", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data, error } = await supabase
      .from("admin_accounts")
      .select("id, username, display_name, active, created_by, created_at, updated_at, last_login_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ admins: [masterAdminToClient(), ...(data || []).map(adminAccountToClient)] });
  } catch (error) {
    console.error("Admin accounts failed:", error.message);
    res.status(500).json({ error: "Unable to load admins." });
  }
});

router.post("/admin/admins", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const username = cleanText(req.body.username);
    const displayName = cleanText(req.body.displayName);
    const password = cleanOptionalText(req.body.password);

    if (!username || !USERNAME_PATTERN.test(username)) {
      return res.status(400).json({
        error: "Admin username must be 3-32 characters and only use letters, numbers, dots, underscores, or hyphens.",
      });
    }

    if (isMasterAdminUsername(username)) {
      return res.status(403).json({ error: "Master admin is protected by environment variables." });
    }

    const passwordHash = hashPassword(password);
    const { data, error } = await supabase
      .from("admin_accounts")
      .insert({
        username,
        display_name: displayName,
        password_hash: passwordHash,
        created_by: req.admin.username,
        active: req.body.active !== false,
      })
      .select("id, username, display_name, active, created_by, created_at, updated_at, last_login_at")
      .single();

    if (error) throw error;

    await writeActivity(req.admin, "create_admin", "admin", data.id, { username });
    res.status(201).json({ admin: adminAccountToClient(data) });
  } catch (error) {
    console.error("Admin create failed:", error.message);
    res.status(500).json({ error: "Unable to create admin." });
  }
});

router.patch("/admin/admins/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    if (req.params.id === "master") {
      return res.status(403).json({ error: "Master admin cannot be edited." });
    }

    const payload = {
      ...(req.body.displayName !== undefined ? { display_name: cleanText(req.body.displayName) } : {}),
      ...(req.body.active !== undefined ? { active: Boolean(req.body.active) } : {}),
      updated_at: new Date().toISOString(),
    };

    if (req.body.password) {
      payload.password_hash = hashPassword(req.body.password);
    }

    const { data, error } = await supabase
      .from("admin_accounts")
      .update(payload)
      .eq("id", req.params.id)
      .select("id, username, display_name, active, created_by, created_at, updated_at, last_login_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Admin not found." });

    await writeActivity(req.admin, "update_admin", "admin", req.params.id);
    res.json({ admin: adminAccountToClient(data) });
  } catch (error) {
    console.error("Admin update failed:", error.message);
    res.status(500).json({ error: "Unable to update admin." });
  }
});

router.delete("/admin/admins/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    if (req.params.id === "master") {
      return res.status(403).json({ error: "Master admin cannot be deleted." });
    }

    if (!req.admin.isMaster && req.admin.id === req.params.id) {
      return res.status(403).json({ error: "Admins cannot delete their own account." });
    }

    const { error } = await supabase.from("admin_accounts").delete().eq("id", req.params.id);

    if (error) throw error;

    await writeActivity(req.admin, "delete_admin", "admin", req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete failed:", error.message);
    res.status(500).json({ error: "Unable to delete admin." });
  }
});

router.post("/admin/users/:id/promote-admin", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data: user, error: userError } = await supabase
      .from("app_users")
      .update({ role: USER_ROLES.ADMIN, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return res.status(404).json({ error: "User not found." });

    await writeActivity(req.admin, "promote_user_admin", "user", req.params.id);
    res.json({ user: userToClient(user) });
  } catch (error) {
    console.error("Admin promote failed:", error.message);
    res.status(500).json({ error: "Unable to promote user." });
  }
});

export default router;
