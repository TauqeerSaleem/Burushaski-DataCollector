import express from "express";
import crypto from "node:crypto";
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
const MIN_ADMIN_PASSWORD_LENGTH = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const DATA_PAGE_SIZE = 50;
const MAX_DATA_PAGE_SIZE = 200;
const EXPORT_LIMIT = 50000;
const MAX_PROMPT_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_RECORDING_BYTES = 30 * 1024 * 1024;
const MAX_RECORDING_MS = 5 * 60 * 1000;
const PROMPT_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;
const ALLOWED_PROMPT_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
]);
const ALLOWED_RECORDING_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "application/octet-stream",
]);
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

function cleanStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item)).filter(Boolean)));
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

function cleanInteger(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function cleanDialect(value) {
  const dialect = cleanText(value);
  return dialect && /^[a-zA-Z0-9_-]{1,40}$/.test(dialect) ? dialect : null;
}

function cleanSearch(value) {
  return cleanText(value)?.replace(/[(),]/g, " ").slice(0, 120) || null;
}

function cleanMimeType(value, fallback = null) {
  return cleanText(value)?.split(";")[0].trim().toLowerCase() || fallback;
}

function cleanEncodedHeader(value) {
  const text = cleanText(value);
  if (!text) return null;

  try {
    return cleanText(decodeURIComponent(text));
  } catch {
    return text;
  }
}

function cleanHeaderText(value, maxLength = 2000) {
  const text = cleanEncodedHeader(value);
  return text ? text.slice(0, maxLength) : null;
}

function cleanBooleanHeader(value) {
  return ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());
}

function cleanFileName(value) {
  return String(value || "prompt-image")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "prompt-image";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function promptMediaStoragePath(value) {
  const media = cleanText(value);
  if (!media) return "";

  const markers = [
    "/storage/v1/object/public/prompt-media/",
    "/storage/v1/object/sign/prompt-media/",
  ];
  const marker = markers.find((candidate) => media.includes(candidate));
  if (marker) {
    return decodeURIComponent(media.slice(media.indexOf(marker) + marker.length).split("?")[0]);
  }

  return isHttpUrl(media) ? "" : media;
}

async function signedPromptMediaUrl(value) {
  const media = cleanText(value);
  if (!media) return "";

  const path = promptMediaStoragePath(media);
  if (!path) return media;

  const { data, error } = await supabase.storage
    .from("prompt-media")
    .createSignedUrl(path, PROMPT_MEDIA_SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("Prompt media signing failed:", error.message);
    return "";
  }

  return data?.signedUrl || "";
}

async function signPromptRows(rows) {
  return Promise.all(
    (rows || []).map(async (row) => {
      if (row.media_type !== "image" || !row.media_url) return row;

      const mediaPath = promptMediaStoragePath(row.media_url) || row.media_url;
      const signedUrl = await signedPromptMediaUrl(row.media_url);

      return {
        ...row,
        media_path: mediaPath,
        signed_media_url: signedUrl || row.media_url,
      };
    })
  );
}

function recordingExtension(contentType) {
  return contentType.includes("mp4")
    ? "m4a"
    : contentType.includes("mpeg")
      ? "mp3"
      : contentType.includes("wav")
        ? "wav"
        : "webm";
}

function cryptoRandomId() {
  return crypto.randomBytes(8).toString("hex");
}

function slugify(value, fallback = "admin") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function generatePromptId(payload) {
  const group = slugify(payload.module_title || payload.module_id || "prompt").slice(0, 24);
  const stamp = Date.now().toString(36);
  const random = cryptoRandomId().slice(0, 8);
  return `${group}-${stamp}-${random}`;
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const rawText = typeof value === "object" ? JSON.stringify(value) : String(value);
  const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.map((column) => csvEscape(column.label)).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvEscape(typeof column.value === "function" ? column.value(row) : row[column.value])).join(",")
    ),
  ].join("\n");
}

function sendCsv(res, filename, rows, columns) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(toCsv(rows, columns));
}

async function requireAdmin(req, res, next) {
  try {
    const admin = verifyAdminToken(getBearerToken(req));

    if (!admin) {
      return res.status(401).json({ error: "Admin login required." });
    }

    if (!admin.isMaster && hasSupabaseConfig && hasServiceRoleKey && supabase) {
      const { data, error } = await supabase
        .from("admin_accounts")
        .select("active")
        .eq("id", admin.id)
        .maybeSingle();

      if (error) throw error;
      if (!data || data.active === false) {
        return res.status(401).json({ error: "Admin account is inactive." });
      }
    }

    req.admin = admin;
    return next();
  } catch (error) {
    console.error("Admin authorization failed:", error.message);
    return res.status(500).json({ error: "Unable to verify admin session." });
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
    email: row.email || "",
    mobileNumber: row.mobile_number || "",
    dialect: row.dialect || "",
    dialects: row.dialects || [],
    otherDialect: row.other_dialect || "",
    gender: row.gender || "",
    age: row.age || "",
    otherLanguageCount: row.other_language_count || "",
    otherLanguages: row.other_languages || [],
    comfortLanguage: row.comfort_language || "",
    placeOfOrigin: row.place_of_origin || "",
    placesLived: row.places_lived || [],
    consentAccepted: Boolean(row.consent_accepted),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recordingCount: row.recording_count || 0,
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
    ...(body.email !== undefined ? { email: cleanText(body.email) } : {}),
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
    ...(body.placeOfOrigin !== undefined ? { place_of_origin: cleanText(body.placeOfOrigin) } : {}),
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
    mediaUrl: row.signed_media_url || row.media_url || "",
    mediaPath: row.media_path || promptMediaStoragePath(row.media_url) || row.media_url || "",
    mediaType: row.media_type || "none",
    difficulty: row.difficulty || "short",
    curriculumStage: row.curriculum_stage || "",
    grammaticalCategory: row.grammatical_category || "",
    weight: row.weight || 0,
    active: row.active !== false,
    sortOrder: row.sort_order || 0,
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recordingCount: row.recording_count || 0,
  };
}

function recordingToClient(row) {
  return {
    id: row.id,
    participantId: row.participant_id,
    dialect: row.dialect || "",
    gender: row.gender || "",
    moduleId: row.module_id,
    sentenceId: row.sentence_id,
    audioPath: row.audio_path,
    audioUrl: row.audio_url || "",
    createdAt: row.created_at,
    promptEnglish: row.prompt_english || "",
    promptType: row.prompt_type || "",
    promptDialect: row.prompt_dialect || "",
    moduleTitle: row.prompt_module_title || "",
    username: row.username || "",
    userRole: row.user_role || "",
    transcript: row.transcript || "",
    englishTranslation: row.english_translation || "",
    correctionFlag: Boolean(row.correction_flag),
    suggestedCorrection: row.suggested_correction || "",
    validationScore: row.validation_score || 0,
    validationWeight: row.validation_weight || 1,
    validationCount: row.validation_count || 0,
    validationYes: row.validation_yes || 0,
    validationNo: row.validation_no || 0,
    validations: row.validations || [],
  };
}

function correctionToClient(row) {
  const correctionText = row.correct_english || row.correction || "";

  return {
    id: row.id,
    participantId: row.participant_id || "",
    moduleId: row.module_id || "",
    promptId: row.sentence_id || "",
    sentenceNumber: row.sentence_number || "",
    correction: correctionText,
    audioPath: row.audio_url || "",
    audioUrl: row.signed_audio_url || row.audio_url || "",
    createdAt: row.created_at,
    promptEnglish: row.prompt_english || "",
    moduleTitle: row.prompt_module_title || row.module_id || "",
    promptType: row.prompt_type || "",
  };
}

function promptPayload(body, admin) {
  const english = cleanText(body.english);

  return {
    ...(body.promptId !== undefined ? { prompt_id: cleanText(body.promptId) } : {}),
    ...(body.moduleId !== undefined ? { module_id: cleanText(body.moduleId) || "general-prompts" } : {}),
    ...(body.moduleTitle !== undefined ? { module_title: cleanText(body.moduleTitle) || "General Prompts" } : {}),
    ...(body.promptType !== undefined ? { prompt_type: cleanText(body.promptType) || "translation" } : {}),
    ...(body.dialect !== undefined ? { dialect: cleanText(body.dialect) } : {}),
    ...(body.english !== undefined ? { english } : {}),
    ...(body.transliteration !== undefined ? { transliteration: cleanText(body.transliteration) } : {}),
    ...(body.mediaUrl !== undefined
      ? { media_url: promptMediaStoragePath(body.mediaUrl) || cleanText(body.mediaUrl) }
      : {}),
    ...(body.mediaType !== undefined ? { media_type: cleanText(body.mediaType) || "none" } : {}),
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
    recordingId: row.recording_id || null,
    requestedOutputs: Array.isArray(row.requested_outputs) ? row.requested_outputs : [],
    sourceType: row.source_type || "audio",
    sourceRef: row.source_ref || "",
    sourceText: row.source_text || "",
    instructions: row.instructions || "",
    status: row.status || "todo",
    priority: row.priority || "normal",
    dueDate: row.due_date || "",
    transcript: row.transcript || "",
    translation: row.translation || "",
    researcherNotes: row.researcher_notes || "",
    adminFeedback: row.admin_feedback || "",
    notes: row.notes || "",
    submittedAt: row.submitted_at || "",
    completedAt: row.completed_at || "",
    appliedToRecordingAt: row.applied_to_recording_at || "",
    appliedBy: row.applied_by || "",
    recording: row.recording || null,
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
    ...(body.recordingId !== undefined
      ? { recording_id: cleanText(body.recordingId) ? cleanInteger(body.recordingId, null, 1) : null }
      : {}),
    ...(body.requestedOutputs !== undefined
      ? { requested_outputs: cleanStringArray(body.requestedOutputs).filter((value) => ["transcript", "translation", "metadata_review", "validation"].includes(value)) }
      : {}),
    ...(body.sourceType !== undefined ? { source_type: cleanText(body.sourceType) || "audio" } : {}),
    ...(body.sourceRef !== undefined ? { source_ref: cleanText(body.sourceRef) } : {}),
    ...(body.sourceText !== undefined ? { source_text: cleanText(body.sourceText) } : {}),
    ...(body.instructions !== undefined ? { instructions: cleanText(body.instructions) } : {}),
    ...(body.status !== undefined ? { status: cleanText(body.status) || "todo" } : {}),
    ...(body.priority !== undefined ? { priority: cleanText(body.priority) || "normal" } : {}),
    ...(body.dueDate !== undefined ? { due_date: cleanText(body.dueDate) } : {}),
    ...(body.transcript !== undefined ? { transcript: cleanText(body.transcript) } : {}),
    ...(body.translation !== undefined ? { translation: cleanText(body.translation) } : {}),
    ...(body.researcherNotes !== undefined ? { researcher_notes: cleanText(body.researcherNotes) } : {}),
    ...(body.adminFeedback !== undefined ? { admin_feedback: cleanText(body.adminFeedback) } : {}),
    ...(body.notes !== undefined ? { notes: cleanText(body.notes) } : {}),
    ...(admin ? { created_by: admin.username } : {}),
    updated_at: new Date().toISOString(),
  };
}

function storageSegment(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "unknown";
}

async function requireActiveResearcherByParticipantId(participantId, res) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, participant_id, username, role, active")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.active === false || normalizeUserRole(data.role) !== USER_ROLES.RESEARCHER) {
    res.status(403).json({ error: "Active researcher account required." });
    return null;
  }

  return data;
}

async function validateResearchTaskLinks(payload, existingTask = null) {
  const assignedTo = payload.assigned_to !== undefined ? payload.assigned_to : existingTask?.assigned_to;
  const recordingId = payload.recording_id !== undefined ? payload.recording_id : existingTask?.recording_id;

  if (assignedTo) {
    const { data: researcher, error } = await supabase
      .from("app_users")
      .select("id, role, active")
      .eq("id", assignedTo)
      .maybeSingle();

    if (error) throw error;
    if (!researcher || researcher.active === false || normalizeUserRole(researcher.role) !== USER_ROLES.RESEARCHER) {
      return "Assignments require an active researcher.";
    }
  }

  if (recordingId) {
    const { data: recording, error } = await supabase
      .from("recordings")
      .select("id")
      .eq("id", recordingId)
      .maybeSingle();

    if (error) throw error;
    if (!recording) return "The selected recording no longer exists.";
    if (!assignedTo) return "Recording assignments require a researcher.";
  }

  return null;
}

async function enrichResearchTasks(rows) {
  const recordingIds = Array.from(new Set((rows || []).map((row) => row.recording_id).filter(Boolean)));
  if (!recordingIds.length) return (rows || []).map(taskToClient);

  const { data: recordings, error } = await supabase
    .from("recordings")
    .select("id, participant_id, dialect, module_id, sentence_id, audio_path, created_at")
    .in("id", recordingIds);

  if (error) throw error;

  const promptIds = Array.from(new Set((recordings || []).map((recording) => recording.sentence_id).filter(Boolean)));
  const participantIds = Array.from(new Set((recordings || []).map((recording) => recording.participant_id).filter(Boolean)));

  const [promptsResult, usersResult] = await Promise.all([
    promptIds.length
      ? supabase.from("prompt_bank").select("prompt_id, module_id, module_title, english, prompt_type").in("prompt_id", promptIds)
      : Promise.resolve({ data: [], error: null }),
    participantIds.length
      ? supabase.from("app_users").select("participant_id, username").in("participant_id", participantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (promptsResult.error) throw promptsResult.error;
  if (usersResult.error) throw usersResult.error;

  const promptMap = new Map(
    (promptsResult.data || []).map((prompt) => [`${prompt.module_id}:${prompt.prompt_id}`, prompt])
  );
  const userMap = new Map((usersResult.data || []).map((user) => [user.participant_id, user]));
  const recordingMap = new Map();

  await Promise.all((recordings || []).map(async (recording) => {
    const prompt = promptMap.get(`${recording.module_id}:${recording.sentence_id}`) || {};
    const participant = userMap.get(recording.participant_id) || {};
    const { data: signedAudio } = await supabase.storage
      .from("audio-recordings")
      .createSignedUrl(recording.audio_path, 60 * 60);

    recordingMap.set(recording.id, {
      id: recording.id,
      participantId: recording.participant_id,
      username: participant.username || "",
      dialect: recording.dialect || "",
      moduleId: recording.module_id,
      moduleTitle: prompt.module_title || recording.module_id,
      promptId: recording.sentence_id,
      promptText: prompt.english || "",
      promptType: prompt.prompt_type || "",
      audioPath: recording.audio_path,
      audioUrl: signedAudio?.signedUrl || "",
      createdAt: recording.created_at,
    });
  }));

  return (rows || []).map((row) => taskToClient({
    ...row,
    recording: row.recording_id ? recordingMap.get(row.recording_id) || null : null,
  }));
}

function researcherTaskToClient(task) {
  const {
    notes: _adminNotes,
    createdBy: _createdBy,
    appliedBy: _appliedBy,
    ...safeTask
  } = task;
  return safeTask;
}

function promptsToModules(rows) {
  const modules = new Map();

  rows.forEach((row) => {
    const moduleId = row.module_id || "general-prompts";
    if (!modules.has(moduleId)) {
      modules.set(moduleId, {
        moduleId,
        title: row.module_title || "General Prompts",
        sentences: [],
      });
    }

    modules.get(moduleId).sentences.push({
      sentenceId: row.prompt_id,
      english: row.english,
      transliteration: row.transliteration || row.english,
      promptType: row.prompt_type,
      mediaUrl: row.signed_media_url || row.media_url || "",
      mediaPath: row.media_path || promptMediaStoragePath(row.media_url) || row.media_url || "",
      mediaType: row.media_type || "none",
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

async function requireActiveParticipant(participantId, res) {
  const { data, error } = await supabase
    .from("app_users")
    .select("participant_id, role, active, dialect, gender")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.active === false || normalizeUserRole(data.role) === USER_ROLES.ADMIN) {
    res.status(403).json({ error: "Active participant account required." });
    return null;
  }

  return data;
}

router.get("/prompts", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const dialect = cleanDialect(req.query.dialect);
    let query = supabase
      .from("prompt_bank")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (dialect) {
      query = query.or(`dialect.is.null,dialect.eq.${dialect},dialect.eq.all`);
    }

    const { data, error } = await query;

    if (error) throw error;

    const signedPrompts = await signPromptRows(data || []);
    res.json(promptsToModules(signedPrompts));
  } catch (error) {
    console.error("Public prompts failed:", error.message);
    res.status(500).json({ error: "Unable to load prompts." });
  }
});

router.get("/volunteer-dashboard", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const dialect = cleanDialect(req.query.dialect);
    const participantId = cleanText(req.query.participantId);

    if (!dialect || !participantId) {
      return res.status(400).json({ error: "Dialect and participant ID are required." });
    }

    const participant = await requireActiveParticipant(participantId, res);
    if (!participant) return;

    const participantDialect = cleanDialect(participant.dialect);
    if (!participantDialect || participantDialect !== dialect) {
      return res.status(403).json({ error: "Participant dialect does not match this request." });
    }

    const [promptsResult, myRecordingsResult, allRecordingsResult] = await Promise.all([
      supabase
        .from("prompt_bank")
        .select("*")
        .eq("active", true)
        .or(`dialect.is.null,dialect.eq.${dialect},dialect.eq.all`)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("recordings")
        .select("sentence_id")
        .eq("participant_id", participantId),
      supabase
        .from("recordings")
        .select("sentence_id"),
    ]);

    const error = [promptsResult, myRecordingsResult, allRecordingsResult]
      .map((result) => result.error)
      .find(Boolean);

    if (error) throw error;

    const globalCounts = {};
    (allRecordingsResult.data || []).forEach((recording) => {
      globalCounts[recording.sentence_id] = (globalCounts[recording.sentence_id] || 0) + 1;
    });

    const signedPrompts = await signPromptRows(promptsResult.data || []);

    res.json({
      prompts: signedPrompts.map((prompt) => ({
        ...prompt,
        media_path: prompt.media_path || promptMediaStoragePath(prompt.media_url) || prompt.media_url || "",
        media_url: prompt.signed_media_url || prompt.media_url || "",
      })),
      recordedIds: (myRecordingsResult.data || []).map((recording) => recording.sentence_id),
      globalCounts,
    });
  } catch (error) {
    console.error("Volunteer dashboard load failed:", error.message);
    res.status(500).json({ error: "Unable to load volunteer dashboard." });
  }
});

async function validateRecordingRequest(body, res) {
  const participantId = cleanText(body.participantId);
  const moduleId = cleanText(body.moduleId);
  const sentenceId = cleanText(body.sentenceId);
  const contentType = cleanMimeType(body.contentType, "audio/webm");
  const recordingDurationMs = cleanInteger(body.durationMs, 0, 0);
  const fileSize = cleanInteger(body.fileSize, 0, 0);

  if (!participantId || !moduleId || !sentenceId) {
    res.status(400).json({ error: "Participant, module, and prompt IDs are required." });
    return null;
  }
  if (!ALLOWED_RECORDING_TYPES.has(contentType)) {
    res.status(415).json({ error: "Unsupported recording format." });
    return null;
  }
  if (recordingDurationMs > MAX_RECORDING_MS + 1000) {
    res.status(413).json({ error: "Recordings must be 5 minutes or shorter." });
    return null;
  }
  if (fileSize < 1 || fileSize > MAX_RECORDING_BYTES) {
    res.status(413).json({ error: "The recording file is empty or too large." });
    return null;
  }

  const participant = await requireActiveParticipant(participantId, res);
  if (!participant) return null;

  const { data: prompt, error: promptError } = await supabase
    .from("prompt_bank")
    .select("active, dialect")
    .eq("module_id", moduleId)
    .eq("prompt_id", sentenceId)
    .maybeSingle();

  if (promptError) throw promptError;
  if (!prompt || prompt.active === false) {
    res.status(409).json({ error: "This prompt is no longer active. Load another prompt and try again." });
    return null;
  }

  const participantDialect = cleanDialect(participant.dialect);
  const promptDialect = cleanDialect(prompt.dialect);
  if (promptDialect && promptDialect !== "all" && promptDialect !== participantDialect) {
    res.status(403).json({ error: "This prompt is not assigned to the participant's dialect." });
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from("recordings")
    .select("*")
    .eq("participant_id", participantId)
    .eq("module_id", moduleId)
    .eq("sentence_id", sentenceId)
    .maybeSingle();

  if (existingError) throw existingError;

  const dialect = participantDialect || "unknown";
  const extension = recordingExtension(contentType);
  const path = [
    storageSegment(dialect),
    storageSegment(participantId),
    storageSegment(moduleId),
    `${storageSegment(sentenceId)}.${extension}`,
  ].join("/");

  return {
    participant,
    existing,
    participantId,
    moduleId,
    sentenceId,
    dialect,
    contentType,
    fileSize,
    path,
  };
}

router.post("/recordings/upload-intent", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;
    const validated = await validateRecordingRequest(req.body || {}, res);
    if (!validated) return;
    if (validated.existing) {
      return res.status(409).json({ error: "This prompt has already been recorded by this volunteer." });
    }

    const { data, error } = await supabase.storage
      .from("audio-recordings")
      .createSignedUploadUrl(validated.path, { upsert: true });

    if (error) throw error;
    res.json({
      path: validated.path,
      token: data.token,
      contentType: validated.contentType,
    });
  } catch (error) {
    console.error("Recording upload intent failed:", error.message);
    res.status(500).json({ error: "Unable to prepare recording upload. Please try again." });
  }
});

router.post("/recordings/complete", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;
    const validated = await validateRecordingRequest(req.body || {}, res);
    if (!validated) return;

    // Completion is intentionally idempotent so a mobile client can retry after
    // losing the response without creating a duplicate row.
    if (validated.existing) {
      if (validated.existing.audio_path === validated.path) {
        return res.json({ recording: recordingToClient(validated.existing) });
      }
      return res.status(409).json({ error: "This prompt has already been recorded by this volunteer." });
    }

    if (cleanText(req.body.path) !== validated.path) {
      return res.status(400).json({ error: "Invalid recording storage path." });
    }

    const pathParts = validated.path.split("/");
    const fileName = pathParts.pop();
    const { data: storedFiles, error: listError } = await supabase.storage
      .from("audio-recordings")
      .list(pathParts.join("/"), { search: fileName, limit: 2 });

    if (listError) throw listError;
    const storedFile = (storedFiles || []).find((file) => file.name === fileName);
    if (!storedFile) {
      return res.status(409).json({ error: "The audio file did not finish uploading. Please try again." });
    }
    const storedSize = Number(storedFile.metadata?.size || 0);
    const storedContentType = cleanMimeType(storedFile.metadata?.mimetype);
    if (
      storedSize < 1 ||
      storedSize > MAX_RECORDING_BYTES ||
      storedSize !== validated.fileSize ||
      (storedContentType && storedContentType !== validated.contentType)
    ) {
      await supabase.storage.from("audio-recordings").remove([validated.path]);
      return res.status(400).json({ error: "The uploaded audio file is incomplete or invalid. Please record it again." });
    }

    const transcript = cleanOptionalText(req.body.transcript);
    const englishTranslation = cleanOptionalText(req.body.englishTranslation);
    const suggestedCorrection = cleanOptionalText(req.body.suggestedCorrection);
    const correctionFlag = Boolean(req.body.correctionFlag);
    const { data, error: dbError } = await supabase
      .from("recordings")
      .insert({
        participant_id: validated.participantId,
        dialect: validated.dialect,
        gender: cleanText(validated.participant.gender),
        module_id: validated.moduleId,
        sentence_id: validated.sentenceId,
        audio_path: validated.path,
        transcript,
        english_translation: englishTranslation,
        correction_flag: correctionFlag,
        suggested_correction: suggestedCorrection,
      })
      .select("*")
      .single();

    if (dbError) {
      if (dbError.code === "23505") {
        const { data: racedRecord } = await supabase
          .from("recordings")
          .select("*")
          .eq("participant_id", validated.participantId)
          .eq("module_id", validated.moduleId)
          .eq("sentence_id", validated.sentenceId)
          .maybeSingle();
        if (racedRecord?.audio_path === validated.path) {
          return res.json({ recording: recordingToClient(racedRecord) });
        }
      }
      await supabase.storage.from("audio-recordings").remove([validated.path]);
      throw dbError;
    }

    if (correctionFlag && suggestedCorrection) {
      const { error: feedbackError } = await supabase.from("feedback").insert({
        participant_id: validated.participantId,
        module_id: validated.moduleId,
        sentence_id: validated.sentenceId,
        correct_english: suggestedCorrection,
        correction: suggestedCorrection,
        audio_url: validated.path,
      });
      if (feedbackError) console.error("Recording correction insert failed:", feedbackError.message);
    }

    res.status(201).json({ recording: recordingToClient(data) });
  } catch (error) {
    console.error("Recording completion failed:", error.message);
    res.status(500).json({ error: "Unable to save recording. Your audio is still available; please retry." });
  }
});

router.post(
  "/recordings",
  express.raw({ type: Array.from(ALLOWED_RECORDING_TYPES), limit: MAX_RECORDING_BYTES }),
  async (req, res) => {
    try {
      if (!requireServiceRole(res)) return;

      const contentType = cleanMimeType(req.get("content-type"), "audio/webm");
      if (!ALLOWED_RECORDING_TYPES.has(contentType)) {
        return res.status(415).json({ error: "Unsupported recording format." });
      }

      if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: "No recording file received." });
      }

      const participantId = cleanText(req.get("x-participant-id"));
      const moduleId = cleanText(req.get("x-module-id"));
      const sentenceId = cleanText(req.get("x-sentence-id"));
      const transcript = cleanHeaderText(req.get("x-transcript"));
      const englishTranslation = cleanHeaderText(req.get("x-english-translation"));
      const suggestedCorrection = cleanHeaderText(req.get("x-suggested-correction"));
      const correctionFlag = cleanBooleanHeader(req.get("x-correction-flag"));
      const recordingDurationMs = cleanInteger(req.get("x-recording-duration-ms"), 0, 0);

      if (!participantId || !moduleId || !sentenceId) {
        return res.status(400).json({ error: "Participant, module, and prompt IDs are required." });
      }

      if (recordingDurationMs > MAX_RECORDING_MS + 1000) {
        return res.status(413).json({ error: "Recordings must be 5 minutes or shorter." });
      }

      const participant = await requireActiveParticipant(participantId, res);
      if (!participant) return;

      const { data: prompt, error: promptError } = await supabase
        .from("prompt_bank")
        .select("active, dialect")
        .eq("module_id", moduleId)
        .eq("prompt_id", sentenceId)
        .maybeSingle();

      if (promptError) throw promptError;
      if (!prompt || prompt.active === false) {
        return res.status(409).json({ error: "This prompt is no longer active. Load another prompt and try again." });
      }

      const participantDialect = cleanDialect(participant.dialect);
      const promptDialect = cleanDialect(prompt.dialect);
      if (promptDialect && promptDialect !== "all" && promptDialect !== participantDialect) {
        return res.status(403).json({ error: "This prompt is not assigned to the participant's dialect." });
      }

      const dialect = participantDialect || "unknown";
      const gender = cleanText(participant.gender);

      const { data: existing, error: existingError } = await supabase
        .from("recordings")
        .select("id")
        .eq("participant_id", participantId)
        .eq("module_id", moduleId)
        .eq("sentence_id", sentenceId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        return res.status(409).json({ error: "This prompt has already been recorded by this volunteer." });
      }

      const extension = recordingExtension(contentType);
      const filePath = `${dialect || "unknown"}/${participantId}/${moduleId}/${sentenceId}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("audio-recordings")
        .upload(filePath, req.body, {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error: dbError } = await supabase
        .from("recordings")
        .insert({
          participant_id: participantId,
          dialect,
          gender,
          module_id: moduleId,
          sentence_id: sentenceId,
          audio_path: filePath,
          transcript,
          english_translation: englishTranslation,
          correction_flag: correctionFlag,
          suggested_correction: suggestedCorrection,
        })
        .select("*")
        .single();

      if (dbError) {
        await supabase.storage.from("audio-recordings").remove([filePath]);
        throw dbError;
      }

      if (correctionFlag && suggestedCorrection) {
        const { error: feedbackError } = await supabase.from("feedback").insert({
          participant_id: participantId,
          module_id: moduleId,
          sentence_id: sentenceId,
          correct_english: suggestedCorrection,
          correction: suggestedCorrection,
          audio_url: filePath,
        });

        if (feedbackError) {
          console.error("Recording correction insert failed:", feedbackError.message);
        }
      }

      res.status(201).json({ recording: recordingToClient(data) });
    } catch (error) {
      console.error("Recording upload failed:", error.message);
      const isDuplicate = String(error.message || "").includes("duplicate key");
      res.status(isDuplicate ? 409 : 500).json({
        error: isDuplicate
          ? "This prompt has already been recorded by this volunteer."
          : "Unable to upload recording.",
      });
    }
  }
);

router.post("/feedback", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const participantId = cleanText(req.body.participantId);
    const moduleId = cleanText(req.body.moduleId);
    const sentenceId = cleanText(req.body.sentenceId);
    const sentenceNumber = cleanInteger(req.body.sentenceNumber, null, 1);
    const correction = cleanText(req.body.correction || req.body.correctEnglish);

    if (!participantId || !moduleId || !sentenceId || !correction) {
      return res.status(400).json({ error: "Participant, prompt, and correction are required." });
    }

    if (!(await requireActiveParticipant(participantId, res))) return;

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        participant_id: participantId,
        module_id: moduleId,
        sentence_id: sentenceId,
        sentence_number: sentenceNumber,
        correction,
        correct_english: cleanText(req.body.correctEnglish),
        audio_url: cleanText(req.body.audioPath),
      })
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json({ feedback: correctionToClient(data) });
  } catch (error) {
    console.error("Feedback submit failed:", error.message);
    res.status(500).json({ error: "Unable to submit feedback." });
  }
});

router.post(
  "/feedback-audio",
  express.raw({ type: Array.from(ALLOWED_RECORDING_TYPES), limit: MAX_RECORDING_BYTES }),
  async (req, res) => {
    try {
      if (!requireServiceRole(res)) return;

      const contentType = cleanMimeType(req.get("content-type"), "audio/webm");
      if (!ALLOWED_RECORDING_TYPES.has(contentType)) {
        return res.status(415).json({ error: "Unsupported feedback audio format." });
      }

      if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: "No feedback audio received." });
      }

      const participantId = cleanText(req.get("x-participant-id"));
      const moduleId = cleanText(req.get("x-module-id"));
      const sentenceId = cleanText(req.get("x-sentence-id"));
      const sentenceNumber = cleanInteger(req.get("x-sentence-number"), null, 1);
      const correction = cleanEncodedHeader(req.get("x-correction"));
      const recordingDurationMs = cleanInteger(req.get("x-recording-duration-ms"), 0, 0);

      if (!participantId || !moduleId || !sentenceId || !correction) {
        return res.status(400).json({ error: "Participant, prompt, and correction are required." });
      }

      if (recordingDurationMs > MAX_RECORDING_MS + 1000) {
        return res.status(413).json({ error: "Recordings must be 5 minutes or shorter." });
      }

      if (!(await requireActiveParticipant(participantId, res))) return;

      const extension = recordingExtension(contentType);
      const filePath = `${participantId}/${moduleId}/${sentenceId}/${Date.now()}-${cryptoRandomId()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("feedback-audio")
        .upload(filePath, req.body, {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error: dbError } = await supabase
        .from("feedback")
        .insert({
          participant_id: participantId,
          module_id: moduleId,
          sentence_id: sentenceId,
          sentence_number: sentenceNumber,
          correct_english: correction,
          audio_url: filePath,
        })
        .select("*")
        .single();

      if (dbError) {
        await supabase.storage.from("feedback-audio").remove([filePath]);
        throw dbError;
      }

      res.status(201).json({ feedback: correctionToClient(data) });
    } catch (error) {
      console.error("Feedback audio submit failed:", error.message);
      res.status(500).json({ error: "Unable to submit feedback audio." });
    }
  }
);

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
      validationsResult,
    ] = await Promise.all([
      supabase.from("app_users").select("role, dialect, gender, created_at"),
      supabase.from("recordings").select("participant_id, module_id, sentence_id, created_at"),
      supabase.from("validations").select("id", { count: "exact", head: true }),
    ]);

    const errors = [usersResult, recordingsResult]
      .map((result) => result.error)
      .filter(Boolean);

    if (errors.length) throw errors[0];

    const users = usersResult.data || [];
    const recordings = recordingsResult.data || [];

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
        validations: validationsResult.error ? 0 : validationsResult.count || 0,
      },
      usersByRole: countBy(users, "role"),
      usersByDialect: countBy(users, "dialect"),
      usersByGender: countBy(users, "gender"),
      recordingsByModule: countBy(recordings, "module_id"),
      recentUsers: users.slice(-8).reverse(),
      recentRecordings: recordings.slice(-8).reverse(),
    });
  } catch (error) {
    console.error("Admin overview failed:", error.message);
    res.status(500).json({ error: "Unable to load admin overview." });
  }
});

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const [usersResult, countsResult] = await Promise.all([
      supabase
        .from("app_users")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("participant_recording_counts")
        .select("participant_id, recording_count"),
    ]);

    const error = usersResult.error || countsResult.error;
    if (error) throw error;

    const countMap = new Map((countsResult.data || []).map((count) => [count.participant_id, count.recording_count || 0]));

    res.json({
      users: (usersResult.data || []).map((user) =>
        userToClient({
          ...user,
          recording_count: countMap.get(user.participant_id) || 0,
        })
      ),
    });
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

    const feedback = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(EXPORT_LIMIT);

    const error = feedback.error;

    if (error) throw error;

    res.json({
      feedback: feedback.data || [],
    });
  } catch (error) {
    console.error("Admin data failed:", error.message);
    res.status(500).json({ error: "Unable to load data." });
  }
});

router.get("/admin/corrections", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const search = cleanSearch(req.query.search);
    const participantId = cleanText(req.query.participantId);
    const moduleId = cleanText(req.query.moduleId);
    const promptId = cleanText(req.query.promptId);

    let query = supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(EXPORT_LIMIT);

    if (participantId) query = query.eq("participant_id", participantId);
    if (moduleId) query = query.eq("module_id", moduleId);
    if (promptId) query = query.eq("sentence_id", promptId);
    if (search) {
      query = query.or(
        [
          `participant_id.ilike.%${search}%`,
          `module_id.ilike.%${search}%`,
          `sentence_id.ilike.%${search}%`,
          `correct_english.ilike.%${search}%`,
          `correction.ilike.%${search}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const promptKeys = (data || [])
      .filter((row) => row.module_id && row.sentence_id)
      .map((row) => ({ moduleId: row.module_id, promptId: row.sentence_id }));
    const promptIds = Array.from(new Set(promptKeys.map((key) => key.promptId)));

    let promptRows = [];
    if (promptIds.length) {
      const { data: prompts, error: promptError } = await supabase
        .from("prompt_bank")
        .select("id, prompt_id, module_id, module_title, prompt_type, dialect, english, transliteration")
        .in("prompt_id", promptIds);

      if (promptError) throw promptError;
      promptRows = prompts || [];
    }

    const promptMap = new Map(promptRows.map((prompt) => [`${prompt.module_id}:${prompt.prompt_id}`, prompt]));

    let reviews = [];
    if (promptKeys.length) {
      const { data: reviewRows, error: reviewError } = await supabase
        .from("prompt_correction_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(EXPORT_LIMIT);

      if (reviewError) throw reviewError;
      reviews = reviewRows || [];
    }

    const reviewsByPrompt = new Map();
    reviews.forEach((review) => {
      const key = `${review.module_id}:${review.prompt_id}`;
      reviewsByPrompt.set(key, [...(reviewsByPrompt.get(key) || []), review]);
    });

    const correctionsWithAudio = await Promise.all(
      (data || []).map(async (row) => {
        if (!row.audio_url) return row;

        const { data: signedAudio } = await supabase.storage
          .from("feedback-audio")
          .createSignedUrl(row.audio_url, 60 * 60);

        return {
          ...row,
          signed_audio_url: signedAudio?.signedUrl || "",
        };
      })
    );

    const groups = new Map();
    correctionsWithAudio.forEach((row) => {
      const prompt = promptMap.get(`${row.module_id}:${row.sentence_id}`) || {};
      const correction = correctionToClient({
        ...row,
        prompt_english: prompt.english,
        prompt_type: prompt.prompt_type,
        prompt_module_title: prompt.module_title,
      });
      const key = `${correction.moduleId}:${correction.promptId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          moduleId: correction.moduleId,
          promptId: correction.promptId,
          moduleTitle: correction.moduleTitle,
          promptType: correction.promptType,
          currentPrompt: correction.promptEnglish,
          count: 0,
          candidates: [],
          corrections: [],
          history: [],
        });
      }

      const group = groups.get(key);
      group.count += 1;
      group.corrections.push(correction);

      const candidateText = correction.correction;
      if (candidateText) {
        const existing = group.candidates.find((candidate) => candidate.text === candidateText);
        if (existing) {
          existing.count += 1;
          existing.feedbackIds.push(correction.id);
          existing.participants.push(correction.participantId);
        } else {
          group.candidates.push({
            text: candidateText,
            count: 1,
            feedbackIds: [correction.id],
            participants: [correction.participantId],
          });
        }
      }
    });

    const groupedCorrections = Array.from(groups.values()).map((group) => {
      group.candidates.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
      group.history = (reviewsByPrompt.get(`${group.moduleId}:${group.promptId}`) || []).map((review) => ({
        id: review.id,
        previousEnglish: review.previous_english || "",
        acceptedCorrection: review.accepted_correction,
        candidateCorrections: review.candidate_corrections || [],
        acceptedFeedbackId: review.accepted_feedback_id,
        reviewedBy: review.reviewed_by || "",
        createdAt: review.created_at,
      }));
      return group;
    });

    groupedCorrections.sort((a, b) => b.count - a.count || a.moduleTitle.localeCompare(b.moduleTitle));

    res.json({
      corrections: correctionsWithAudio.map((row) => {
        const prompt = promptMap.get(`${row.module_id}:${row.sentence_id}`) || {};
        return correctionToClient({
          ...row,
          prompt_english: prompt.english,
          prompt_type: prompt.prompt_type,
          prompt_module_title: prompt.module_title,
        });
      }),
      groups: groupedCorrections,
      total: correctionsWithAudio.length,
    });
  } catch (error) {
    console.error("Admin corrections failed:", error.message);
    res.status(500).json({ error: "Unable to load corrections." });
  }
});

router.post("/admin/corrections/approve", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const moduleId = cleanText(req.body.moduleId);
    const promptId = cleanText(req.body.promptId);
    const acceptedCorrection = cleanText(req.body.correction);
    const acceptedFeedbackId = req.body.feedbackId ? cleanInteger(req.body.feedbackId, null, 1) : null;

    if (!moduleId || !promptId || !acceptedCorrection) {
      return res.status(400).json({ error: "Prompt group, prompt, and correction are required." });
    }

    const { data: promptRows, error: promptError } = await supabase
      .from("prompt_bank")
      .select("*")
      .eq("module_id", moduleId)
      .eq("prompt_id", promptId);

    if (promptError) throw promptError;
    if (!promptRows?.length) return res.status(404).json({ error: "Prompt not found." });

    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("feedback")
      .select("*")
      .eq("module_id", moduleId)
      .eq("sentence_id", promptId)
      .order("created_at", { ascending: false })
      .limit(EXPORT_LIMIT);

    if (feedbackError) throw feedbackError;

    const candidateMap = new Map();
    (feedbackRows || []).forEach((row) => {
      const text = row.correct_english || row.correction;
      if (!text) return;
      const current = candidateMap.get(text) || { text, count: 0, feedbackIds: [] };
      current.count += 1;
      current.feedbackIds.push(row.id);
      candidateMap.set(text, current);
    });

    const candidateCorrections = Array.from(candidateMap.values()).sort((a, b) => b.count - a.count);
    const previousEnglish = promptRows[0].english || "";

    const { error: updateError } = await supabase
      .from("prompt_bank")
      .update({
        english: acceptedCorrection,
        updated_at: new Date().toISOString(),
      })
      .eq("module_id", moduleId)
      .eq("prompt_id", promptId);

    if (updateError) throw updateError;

    const { data: review, error: reviewError } = await supabase
      .from("prompt_correction_reviews")
      .insert({
        prompt_bank_id: promptRows[0].id,
        module_id: moduleId,
        prompt_id: promptId,
        previous_english: previousEnglish,
        accepted_correction: acceptedCorrection,
        candidate_corrections: candidateCorrections,
        accepted_feedback_id: acceptedFeedbackId,
        reviewed_by: req.admin.username,
      })
      .select("*")
      .single();

    if (reviewError) throw reviewError;

    await writeActivity(req.admin, "approve_correction", "prompt", promptRows[0].id, {
      moduleId,
      promptId,
      previousEnglish,
      acceptedCorrection,
      acceptedFeedbackId,
    });

    res.json({ review });
  } catch (error) {
    console.error("Admin correction approval failed:", error.message);
    res.status(500).json({ error: "Unable to approve correction." });
  }
});

router.get("/admin/records", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const page = cleanInteger(req.query.page, 1, 1);
    const pageSize = cleanInteger(req.query.pageSize, DATA_PAGE_SIZE, 1, MAX_DATA_PAGE_SIZE);
    const participantId = cleanText(req.query.participantId);
    const moduleId = cleanText(req.query.moduleId);
    const dialect = cleanDialect(req.query.dialect);
    const roleFilter = cleanText(req.query.role);
    const participantRole = Object.values(USER_ROLES).includes(roleFilter) ? roleFilter : null;
    const search = cleanSearch(req.query.search);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let promptSearchIds = [];
    if (search) {
      const { data: matchingPrompts, error: promptSearchError } = await supabase
        .from("prompt_bank")
        .select("prompt_id")
        .ilike("english", `%${search}%`)
        .limit(1000);

      if (promptSearchError) throw promptSearchError;
      promptSearchIds = Array.from(new Set((matchingPrompts || []).map((prompt) => prompt.prompt_id)));
    }

    let roleParticipantIds = null;
    if (participantRole) {
      const { data: matchingUsers, error: roleSearchError } = await supabase
        .from("app_users")
        .select("participant_id")
        .eq("role", participantRole)
        .limit(EXPORT_LIMIT);

      if (roleSearchError) throw roleSearchError;
      roleParticipantIds = (matchingUsers || []).map((user) => user.participant_id).filter(Boolean);

      if (roleParticipantIds.length === 0 || (participantId && !roleParticipantIds.includes(participantId))) {
        return res.json({
          rows: [],
          page,
          pageSize,
          total: 0,
          totalPages: 1,
        });
      }
    }

    let participantSearchIds = [];
    if (search) {
      const { data: matchingUsers, error: userSearchError } = await supabase
        .from("app_users")
        .select("participant_id")
        .or([
          `participant_id.ilike.%${search}%`,
          `username.ilike.%${search}%`,
          `display_name.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `mobile_number.ilike.%${search}%`,
        ].join(","))
        .limit(1000);

      if (userSearchError) throw userSearchError;
      participantSearchIds = Array.from(new Set((matchingUsers || []).map((user) => user.participant_id).filter(Boolean)));
    }

    let query = supabase
      .from("recordings")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (participantId) query = query.eq("participant_id", participantId);
    if (!participantId && roleParticipantIds) query = query.in("participant_id", roleParticipantIds);
    if (moduleId) query = query.eq("module_id", moduleId);
    if (dialect) query = query.eq("dialect", dialect);
    if (search) {
      const searchClauses = [
        `participant_id.ilike.%${search}%`,
        `dialect.ilike.%${search}%`,
        `module_id.ilike.%${search}%`,
        `sentence_id.ilike.%${search}%`,
        `audio_path.ilike.%${search}%`,
        `transcript.ilike.%${search}%`,
        `english_translation.ilike.%${search}%`,
        `suggested_correction.ilike.%${search}%`,
        ...participantSearchIds.map((id) => `participant_id.eq.${id}`),
        ...promptSearchIds.map((promptId) => `sentence_id.eq.${promptId}`),
      ];
      query = query.or(searchClauses.join(","));
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    const promptKeys = (data || []).map((recording) => ({
      moduleId: recording.module_id,
      promptId: recording.sentence_id,
    }));

    let promptMap = new Map();
    if (promptKeys.length) {
      const promptIds = Array.from(new Set(promptKeys.map((key) => key.promptId)));
      const { data: promptRows, error: promptError } = await supabase
        .from("prompt_bank")
        .select("prompt_id, module_id, module_title, prompt_type, dialect, english")
        .in("prompt_id", promptIds);

      if (promptError) throw promptError;
      promptMap = new Map((promptRows || []).map((prompt) => [`${prompt.module_id}:${prompt.prompt_id}`, prompt]));
    }

    const participantIds = Array.from(new Set((data || []).map((recording) => recording.participant_id).filter(Boolean)));
    let participantMap = new Map();
    if (participantIds.length) {
      const { data: userRows, error: userError } = await supabase
        .from("app_users")
        .select("participant_id, username, role, dialect, gender, age")
        .in("participant_id", participantIds);

      if (userError) throw userError;
      participantMap = new Map((userRows || []).map((user) => [user.participant_id, user]));
    }

    const recordingIds = (data || []).map((recording) => recording.id).filter(Boolean);
    const validationMap = new Map();
    if (recordingIds.length) {
      const { data: validations, error: validationError } = await supabase
        .from("validations")
        .select("recording_id, validator_id, vote, created_at")
        .in("recording_id", recordingIds);

      if (!validationError) {
        const validatorIds = Array.from(new Set((validations || []).map((validation) => validation.validator_id).filter(Boolean)));
        let validatorMap = new Map();
        if (validatorIds.length) {
          const { data: validatorRows, error: validatorError } = await supabase
            .from("app_users")
            .select("participant_id, username, role")
            .in("participant_id", validatorIds);

          if (!validatorError) {
            validatorMap = new Map((validatorRows || []).map((user) => [user.participant_id, user]));
          } else {
            console.warn("Admin validation voter names unavailable:", validatorError.message);
          }
        }

        (validations || []).forEach((validation) => {
          const current = validationMap.get(validation.recording_id) || { count: 0, yes: 0, no: 0, items: [] };
          const validator = validatorMap.get(validation.validator_id) || {};
          current.count += 1;
          if (Number(validation.vote) > 0) current.yes += 1;
          if (Number(validation.vote) < 0) current.no += 1;
          current.items.push({
            validatorId: validation.validator_id || "",
            validatorUsername: validator.username || validation.validator_id || "Unknown validator",
            validatorRole: validator.role || "",
            vote: Number(validation.vote) > 0 ? "yes" : Number(validation.vote) < 0 ? "no" : "neutral",
            createdAt: validation.created_at || "",
          });
          validationMap.set(validation.recording_id, current);
        });
      } else {
        console.warn("Admin validation summary unavailable:", validationError.message);
      }
    }

    const rows = await Promise.all((data || []).map(async (recording) => {
        const prompt = promptMap.get(`${recording.module_id}:${recording.sentence_id}`) || {};
        const participant = participantMap.get(recording.participant_id) || {};
        const validation = validationMap.get(recording.id) || {};
        const { data: signedAudio } = await supabase.storage
          .from("audio-recordings")
          .createSignedUrl(recording.audio_path, 60 * 60);

        return recordingToClient({
          ...recording,
          audio_url: signedAudio?.signedUrl,
          prompt_english: prompt.english,
          prompt_type: prompt.prompt_type,
          prompt_dialect: prompt.dialect,
          prompt_module_title: prompt.module_title,
          username: participant.username,
          user_role: participant.role,
          validation_count: validation.count || 0,
          validation_yes: validation.yes || 0,
          validation_no: validation.no || 0,
          validations: validation.items || [],
        });
      }));

    res.json({
      rows,
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    });
  } catch (error) {
    console.error("Admin records failed:", error.message);
    res.status(500).json({ error: "Unable to load recording records." });
  }
});

router.get("/admin/export/:type", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const type = cleanText(req.params.type);

    if (type === "recordings") {
      const { data, error } = await supabase
        .from("recordings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(EXPORT_LIMIT);

      if (error) throw error;

      const promptIds = Array.from(new Set((data || []).map((recording) => recording.sentence_id)));
      let promptMap = new Map();
      if (promptIds.length) {
        const { data: prompts, error: promptsError } = await supabase
          .from("prompt_bank")
          .select("prompt_id, module_id, module_title, prompt_type, dialect, english, transliteration, media_type, media_url")
          .in("prompt_id", promptIds);

        if (promptsError) throw promptsError;
        promptMap = new Map((prompts || []).map((prompt) => [`${prompt.module_id}:${prompt.prompt_id}`, prompt]));
      }

      const rows = (data || []).map((recording) => {
        const prompt = promptMap.get(`${recording.module_id}:${recording.sentence_id}`) || {};
        return { ...recording, prompt };
      });

      return sendCsv(res, "project-yaaran-recordings.csv", rows, [
        { label: "recording_id", value: "id" },
        { label: "participant_id", value: "participant_id" },
        { label: "dialect", value: "dialect" },
        { label: "gender", value: "gender" },
        { label: "module_id", value: "module_id" },
        { label: "module_title", value: (row) => row.prompt.module_title },
        { label: "prompt_id", value: "sentence_id" },
        { label: "prompt_type", value: (row) => row.prompt.prompt_type },
        { label: "prompt_dialect", value: (row) => row.prompt.dialect },
        { label: "prompt_english", value: (row) => row.prompt.english },
        { label: "prompt_transliteration", value: (row) => row.prompt.transliteration },
        { label: "prompt_media_type", value: (row) => row.prompt.media_type },
        { label: "prompt_media_url", value: (row) => row.prompt.media_url },
        { label: "transcript", value: "transcript" },
        { label: "english_translation", value: "english_translation" },
        { label: "correction_flag", value: "correction_flag" },
        { label: "suggested_correction", value: "suggested_correction" },
        { label: "audio_path", value: "audio_path" },
        { label: "created_at", value: "created_at" },
      ]);
    }

    if (type === "participants") {
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(EXPORT_LIMIT);

      if (error) throw error;

      return sendCsv(res, "project-yaaran-participants.csv", data || [], [
        { label: "participant_id", value: "participant_id" },
        { label: "username", value: "username" },
        { label: "role", value: "role" },
        { label: "display_name", value: "display_name" },
        { label: "email", value: "email" },
        { label: "dialect", value: "dialect" },
        { label: "dialects", value: (row) => (row.dialects || []).join("; ") },
        { label: "gender", value: "gender" },
        { label: "age", value: "age" },
        { label: "mobile_number", value: "mobile_number" },
        { label: "comfort_language", value: "comfort_language" },
        { label: "place_of_origin", value: "place_of_origin" },
        { label: "places_lived", value: (row) => (row.places_lived || []).join("; ") },
        { label: "other_languages", value: (row) => (row.other_languages || []).join("; ") },
        { label: "active", value: "active" },
        { label: "created_at", value: "created_at" },
      ]);
    }

    if (type === "prompts") {
      const { data, error } = await supabase
        .from("prompt_bank")
        .select("*")
        .order("module_id", { ascending: true })
        .order("sort_order", { ascending: true })
        .limit(EXPORT_LIMIT);

      if (error) throw error;

      return sendCsv(res, "project-yaaran-prompts.csv", data || [], [
        { label: "prompt_id", value: "prompt_id" },
        { label: "module_id", value: "module_id" },
        { label: "module_title", value: "module_title" },
        { label: "prompt_type", value: "prompt_type" },
        { label: "dialect", value: "dialect" },
        { label: "english", value: "english" },
        { label: "transliteration", value: "transliteration" },
        { label: "media_type", value: "media_type" },
        { label: "media_url", value: "media_url" },
        { label: "difficulty", value: "difficulty" },
        { label: "grammatical_category", value: "grammatical_category" },
        { label: "weight", value: "weight" },
        { label: "active", value: "active" },
      ]);
    }

    return res.status(404).json({ error: "Unknown export type." });
  } catch (error) {
    console.error("Admin export failed:", error.message);
    res.status(500).json({ error: "Unable to export admin data." });
  }
});

router.post(
  "/admin/prompt-media",
  requireAdmin,
  express.raw({ type: Array.from(ALLOWED_PROMPT_MEDIA_TYPES), limit: MAX_PROMPT_MEDIA_BYTES }),
  async (req, res) => {
    try {
      if (!requireServiceRole(res)) return;

      const contentType = cleanMimeType(req.get("content-type"));
      if (!ALLOWED_PROMPT_MEDIA_TYPES.has(contentType)) {
        return res.status(415).json({ error: "Prompt media must be a JPG, PNG, WebP, GIF, or BMP image." });
      }

      if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: "No image file received." });
      }

      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/bmp": "bmp",
        "image/x-ms-bmp": "bmp",
      }[contentType];
      const fileName = cleanFileName(req.get("x-file-name"));
      const path = `prompt-images/${Date.now()}-${cryptoRandomId()}-${fileName}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("prompt-media")
        .upload(path, req.body, {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: signedMedia, error: signedError } = await supabase.storage
        .from("prompt-media")
        .createSignedUrl(path, PROMPT_MEDIA_SIGNED_URL_TTL_SECONDS);

      if (signedError) throw signedError;

      await writeActivity(req.admin, "upload_prompt_media", "prompt_media", path);
      res.status(201).json({ path, signedUrl: signedMedia?.signedUrl || "" });
    } catch (error) {
      console.error("Admin prompt media upload failed:", error.message);
      res.status(500).json({ error: "Unable to upload prompt media." });
    }
  }
);

router.get("/admin/prompts", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const [promptsResult, countsResult] = await Promise.all([
      supabase
        .from("prompt_bank")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("prompt_recording_counts")
        .select("module_id, prompt_id, recording_count"),
    ]);

    const error = promptsResult.error || countsResult.error;
    if (error) throw error;

    const countMap = new Map(
      (countsResult.data || []).map((count) => [`${count.module_id}:${count.prompt_id}`, count.recording_count || 0])
    );

    const signedPrompts = await signPromptRows(promptsResult.data || []);

    res.json({
      prompts: signedPrompts.map((prompt) =>
        promptToClient({
          ...prompt,
          recording_count: countMap.get(`${prompt.module_id}:${prompt.prompt_id}`) || 0,
        })
      ),
    });
  } catch (error) {
    console.error("Admin prompts failed:", error.message);
    res.status(500).json({ error: "Unable to load prompts." });
  }
});

router.post("/admin/prompts", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const payload = promptPayload(req.body, req.admin);

    if (!payload.english) {
      return res.status(400).json({ error: "Volunteer-facing prompt text is required." });
    }

    if (payload.prompt_type === "picture_description" && !payload.media_url) {
      return res.status(400).json({ error: "Image prompts require an image URL or uploaded image." });
    }

    payload.prompt_id = payload.prompt_id || generatePromptId(payload);
    payload.module_id = payload.module_id || slugify(payload.module_title, "general-prompts");
    payload.module_title = payload.module_title || "General Prompts";
    payload.media_type = payload.prompt_type === "picture_description" ? "image" : payload.media_type || "none";
    payload.difficulty = payload.difficulty || "short";
    payload.weight = payload.weight || 1;
    payload.sort_order = payload.sort_order || 0;

    const { data, error } = await supabase
      .from("prompt_bank")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    await writeActivity(req.admin, "create_prompt", "prompt", data.id, { promptId: data.prompt_id });
    const [signedPrompt] = await signPromptRows([data]);
    res.status(201).json({ prompt: promptToClient(signedPrompt) });
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

    if (payload.prompt_type === "picture_description" && !payload.media_url) {
      return res.status(400).json({ error: "Image prompts require an image URL or uploaded image." });
    }

    if (payload.prompt_type === "picture_description") {
      payload.media_type = "image";
    }

    const { data, error } = await supabase
      .from("prompt_bank")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Prompt not found." });

    await writeActivity(req.admin, "update_prompt", "prompt", req.params.id);
    const [signedPrompt] = await signPromptRows([data]);
    res.json({ prompt: promptToClient(signedPrompt) });
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
    const [signedPrompt] = await signPromptRows([data]);
    res.json({ prompt: promptToClient(signedPrompt) });
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

    res.json({ tasks: await enrichResearchTasks(data || []) });
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

    const linkError = await validateResearchTaskLinks(payload);
    if (linkError) return res.status(400).json({ error: linkError });

    if (payload.recording_id) {
      payload.source_type = "recording";
      payload.source_ref = String(payload.recording_id);
      if (!payload.requested_outputs?.length) {
        return res.status(400).json({ error: "Select at least one requested output." });
      }

      const { data: duplicate, error: duplicateError } = await supabase
        .from("research_tasks")
        .select("id")
        .eq("recording_id", payload.recording_id)
        .eq("assigned_to", payload.assigned_to)
        .neq("status", "done")
        .limit(1);

      if (duplicateError) throw duplicateError;
      if (duplicate?.length) {
        return res.status(409).json({ error: "This recording already has an open assignment for that researcher." });
      }
    }

    const { data, error } = await supabase
      .from("research_tasks")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    await writeActivity(req.admin, "create_research_task", "research_task", data.id);
    const [task] = await enrichResearchTasks([data]);
    res.status(201).json({ task });
  } catch (error) {
    console.error("Admin research task create failed:", error.message);
    if (error.code === "23505") {
      return res.status(409).json({ error: "This recording already has an open assignment for that researcher." });
    }
    res.status(500).json({ error: "Unable to create research task." });
  }
});

router.patch("/admin/research-tasks/:id", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data: existingTask, error: existingError } = await supabase
      .from("research_tasks")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingTask) return res.status(404).json({ error: "Research task not found." });

    const payload = taskPayload(req.body);
    delete payload.created_by;

    const linkError = await validateResearchTaskLinks(payload, existingTask);
    if (linkError) return res.status(400).json({ error: linkError });

    const nextStatus = payload.status || existingTask.status;
    if (nextStatus === "done" && existingTask.status !== "done") {
      payload.completed_at = new Date().toISOString();
    } else if (payload.status && payload.status !== "done") {
      payload.completed_at = null;
    }

    const { data, error } = await supabase
      .from("research_tasks")
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    await writeActivity(req.admin, "update_research_task", "research_task", req.params.id);
    const [task] = await enrichResearchTasks([data]);
    res.json({ task });
  } catch (error) {
    console.error("Admin research task update failed:", error.message);
    res.status(500).json({ error: "Unable to update research task." });
  }
});

router.post("/admin/research-tasks/:id/apply", requireAdmin, async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const { data: task, error } = await supabase
      .from("research_tasks")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!task) return res.status(404).json({ error: "Research task not found." });
    if (!task.recording_id) return res.status(400).json({ error: "This task is not linked to a recording." });

    const { data: appliedRows, error: applyError } = await supabase.rpc(
      "apply_research_task_result",
      { task_id: task.id, admin_username: req.admin.username }
    );

    if (applyError) {
      const message = applyError.message || "";
      if (message.includes("required") || message.includes("not linked") || message.includes("no transcript or translation")) {
        return res.status(400).json({ error: message });
      }
      if (message.includes("not found")) return res.status(404).json({ error: message });
      throw applyError;
    }

    const updatedTask = appliedRows?.[0];
    if (!updatedTask) return res.status(500).json({ error: "Assignment apply returned no result." });

    await writeActivity(req.admin, "apply_research_task", "research_task", task.id, {
      recordingId: task.recording_id,
      fields: task.requested_outputs,
    });

    const [enriched] = await enrichResearchTasks([updatedTask]);
    res.json({ task: enriched });
  } catch (error) {
    console.error("Admin research task apply failed:", error.message);
    res.status(500).json({ error: "Unable to apply research task to recording." });
  }
});

router.get("/researcher/tasks", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const participantId = cleanText(req.query.participantId);
    if (!participantId) return res.status(400).json({ error: "Participant ID is required." });

    const researcher = await requireActiveResearcherByParticipantId(participantId, res);
    if (!researcher) return;

    const { data, error } = await supabase
      .from("research_tasks")
      .select("*")
      .eq("assigned_to", researcher.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const tasks = await enrichResearchTasks(data || []);
    res.json({ tasks: tasks.map(researcherTaskToClient) });
  } catch (error) {
    console.error("Researcher tasks failed:", error.message);
    res.status(500).json({ error: "Unable to load assigned research tasks." });
  }
});

router.patch("/researcher/tasks/:id", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const participantId = cleanText(req.body.participantId);
    if (!participantId) return res.status(400).json({ error: "Participant ID is required." });

    const researcher = await requireActiveResearcherByParticipantId(participantId, res);
    if (!researcher) return;

    const { data: task, error: taskError } = await supabase
      .from("research_tasks")
      .select("*")
      .eq("id", req.params.id)
      .eq("assigned_to", researcher.id)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) return res.status(404).json({ error: "Assigned task not found." });
    if (task.status === "done") return res.status(409).json({ error: "Completed assignments cannot be changed." });

    const requestedOutputs = Array.isArray(task.requested_outputs) ? task.requested_outputs : [];
    const requestedStatus = cleanText(req.body.status);
    const status = ["in_progress", "review"].includes(requestedStatus) ? requestedStatus : task.status;
    const transcript = req.body.transcript !== undefined ? cleanText(req.body.transcript) : task.transcript;
    const translation = req.body.translation !== undefined ? cleanText(req.body.translation) : task.translation;

    if (status === "review") {
      if (requestedOutputs.includes("transcript") && !transcript) {
        return res.status(400).json({ error: "Complete the transcript before submitting for review." });
      }
      if (requestedOutputs.includes("translation") && !translation) {
        return res.status(400).json({ error: "Complete the translation before submitting for review." });
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("research_tasks")
      .update({
        transcript,
        translation,
        researcher_notes: req.body.researcherNotes !== undefined
          ? cleanText(req.body.researcherNotes)
          : task.researcher_notes,
        status,
        submitted_at: status === "review" ? now : null,
        admin_feedback: status === "review" ? null : task.admin_feedback,
        updated_at: now,
      })
      .eq("id", task.id)
      .select("*")
      .single();

    if (error) throw error;
    const [enriched] = await enrichResearchTasks([updated]);
    res.json({ task: researcherTaskToClient(enriched) });
  } catch (error) {
    console.error("Researcher task update failed:", error.message);
    res.status(500).json({ error: "Unable to update assigned task." });
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

    if (!req.admin.isMaster) {
      return res.status(403).json({ error: "Only master admin can create admin accounts." });
    }

    const username = cleanText(req.body.username);
    const password = cleanOptionalText(req.body.password);

    if (!username || !USERNAME_PATTERN.test(username)) {
      return res.status(400).json({
        error: "Admin username must be 3-32 characters and only use letters, numbers, dots, underscores, or hyphens.",
      });
    }

    if (isMasterAdminUsername(username)) {
      return res.status(403).json({ error: "Master admin is protected by environment variables." });
    }

    if (!password || password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: "Admin password must be at least 10 characters." });
    }

    const passwordHash = hashPassword(password);
    const { data, error } = await supabase
      .from("admin_accounts")
      .insert({
        username,
        display_name: null,
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
      return res.status(403).json({ error: "Master admin is managed by environment variables." });
    }

    const password = cleanOptionalText(req.body.password);
    const isSelf = req.admin.id === req.params.id;

    if (!req.admin.isMaster && !isSelf) {
      return res.status(403).json({ error: "Admins can only edit their own account." });
    }

    if (password && password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: "Admin password must be at least 10 characters." });
    }

    const payload = {
      updated_at: new Date().toISOString(),
    };

    if (req.body.active !== undefined) {
      const active = Boolean(req.body.active);
      if (!req.admin.isMaster && active) {
        return res.status(403).json({ error: "Inactive admins must be re-enabled by master admin." });
      }
      payload.active = active;
    }

    if (password) {
      payload.password_hash = hashPassword(password);
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

    if (!req.admin.isMaster && req.admin.id !== req.params.id) {
      return res.status(403).json({ error: "Admins can only disable their own account." });
    }

    const { error } = await supabase
      .from("admin_accounts")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", req.params.id);

    if (error) throw error;

    await writeActivity(req.admin, "disable_admin", "admin", req.params.id);
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

router.get("/validation-tasks", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const dialect = cleanDialect(req.query.dialect);
    const participantId = cleanText(req.query.participantId);

    if (!dialect || !participantId) {
      return res.status(400).json({ error: "Dialect and participant ID are required." });
    }

    const participant = await requireActiveParticipant(participantId, res);
    if (!participant) return;
    if (cleanDialect(participant.dialect) !== dialect) {
      return res.status(403).json({ error: "Participant dialect does not match this request." });
    }

    // Fetch recordings in volunteer's dialect, excluding their own
    const { data: recordings, error: rErr } = await supabase
      .from("recordings")
      .select("id, participant_id, dialect, module_id, sentence_id, audio_path, validation_score, validation_weight")
      .eq("dialect", dialect)
      .neq("participant_id", participantId);

    if (rErr) throw rErr;

    if (!recordings || recordings.length === 0) {
      return res.json({ tasks: [], validatedIds: [], globalValidationCounts: {} });
    }

    // Get prompt_bank entries to filter out image prompts and get English text
    const sentenceIds = Array.from(new Set(recordings.map((r) => r.sentence_id)));
    const { data: prompts, error: pErr } = await supabase
      .from("prompt_bank")
      .select("prompt_id, english, prompt_type, module_title")
      .in("prompt_id", sentenceIds)
      .neq("prompt_type", "picture_description");

    if (pErr) throw pErr;

    const promptMap = new Map((prompts || []).map((p) => [p.prompt_id, p]));

    // Only keep recordings with a matching non-image prompt
    const validRecordings = recordings.filter((r) => promptMap.has(r.sentence_id));
    const recordingIds = validRecordings.map((r) => r.id);

    if (recordingIds.length === 0) {
      return res.json({ tasks: [], validatedIds: [], globalValidationCounts: {} });
    }

    // Get which recordings this volunteer has already validated
    const { data: myValidations, error: vErr } = await supabase
      .from("validations")
      .select("recording_id")
      .eq("validator_id", participantId)
      .in("recording_id", recordingIds);

    if (vErr) throw vErr;

    // Get global validation counts per recording
    const { data: allValidations, error: gErr } = await supabase
      .from("validations")
      .select("recording_id")
      .in("recording_id", recordingIds);

    if (gErr) throw gErr;

    const globalValidationCounts = {};
    (allValidations || []).forEach((v) => {
      globalValidationCounts[v.recording_id] = (globalValidationCounts[v.recording_id] || 0) + 1;
    });

    // Generate signed audio URLs
    const tasks = await Promise.all(
      validRecordings.map(async (r) => {
        const prompt = promptMap.get(r.sentence_id);
        const { data: signed } = await supabase.storage
          .from("audio-recordings")
          .createSignedUrl(r.audio_path, 60 * 60);

        return {
          id: r.id,
          participantId: r.participant_id,
          dialect: r.dialect,
          moduleId: r.module_id,
          moduleTitle: prompt?.module_title || "",
          sentenceId: r.sentence_id,
          english: prompt?.english || "",
          audioUrl: signed?.signedUrl || "",
          validationScore: r.validation_score || 0,
          validationWeight: r.validation_weight || 1,
          _cardType: "validation",
        };
      })
    );

    res.json({
      tasks,
      validatedIds: (myValidations || []).map((v) => v.recording_id),
      globalValidationCounts,
    });
  } catch (error) {
    console.error("Validation tasks fetch failed:", error.message);
    res.status(500).json({ error: "Unable to load validation tasks." });
  }
});

router.post("/validations", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const recordingId = cleanInteger(req.body.recordingId, null, 1);
    const participantId = cleanText(req.body.participantId);
    const vote = req.body.vote === 1 || req.body.vote === "1" ? 1 : -1;

    if (!recordingId || !participantId) {
      return res.status(400).json({ error: "Recording ID and participant ID are required." });
    }

    if (!(await requireActiveParticipant(participantId, res))) return;

    // Check not validating own recording
    const { data: recording, error: rErr } = await supabase
      .from("recordings")
      .select("id, participant_id, validation_score")
      .eq("id", recordingId)
      .maybeSingle();

    if (rErr) throw rErr;
    if (!recording) return res.status(404).json({ error: "Recording not found." });
    if (recording.participant_id === participantId) {
      return res.status(403).json({ error: "You cannot validate your own recording." });
    }

    // Insert validation vote
    const { error: vErr } = await supabase
      .from("validations")
      .insert({ recording_id: recordingId, validator_id: participantId, vote });

    if (vErr) {
      if (vErr.code === "23505") {
        return res.status(409).json({ error: "You have already validated this recording." });
      }
      throw vErr;
    }

    // Update running score on recordings
    const { error: uErr } = await supabase
      .from("recordings")
      .update({ validation_score: (recording.validation_score || 0) + vote })
      .eq("id", recordingId);

    if (uErr) throw uErr;

    res.status(201).json({ success: true, vote });
  } catch (error) {
    console.error("Validation submit failed:", error.message);
    res.status(500).json({ error: "Unable to submit validation." });
  }
});

export default router;
