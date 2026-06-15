import crypto from "node:crypto";
import express from "express";
import { hasServiceRoleKey, hasSupabaseConfig, supabase } from "../supabaseClient.js";
import { normalizeUserRole } from "../utils/roles.js";

const router = express.Router();

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;
const LEGACY_PARTICIPANT_ID_PATTERN = /^P-\d+$/i;

function requireServiceRole(res) {
  if (!hasSupabaseConfig || !supabase) {
    res.status(500).json({
      error: "User management API requires Supabase backend environment variables.",
    });
    return false;
  }

  if (hasServiceRoleKey) return true;

  res.status(500).json({
    error: "User management API requires SUPABASE_SERVICE_ROLE_KEY on the backend.",
  });
  return false;
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function cleanArray(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(",");
  return items
    .map((item) => {
      if (item && typeof item === "object") {
        return cleanText([item.city, item.country].filter(Boolean).join(", "));
      }

      return cleanText(item);
    })
    .filter(Boolean);
}

function normalizeUsername(username) {
  const value = cleanText(username);
  if (!value) return null;
  return value;
}

function validateUsername(username) {
  return USERNAME_PATTERN.test(username);
}

function createParticipantId(username) {
  if (LEGACY_PARTICIPANT_ID_PATTERN.test(username)) {
    return username.toUpperCase();
  }

  return `B-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

function errorResponse(message, error) {
  if (process.env.NODE_ENV === "production") {
    return { error: message };
  }

  return {
    error: message,
    details: error?.message || "Unknown backend error.",
    code: error?.code || null,
    hint: error?.hint || null,
    cause: error?.cause?.message || null,
  };
}

function toClientUser(row) {
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
  };
}

function userPayload(body, { includeParticipantId = false } = {}) {
  const username = normalizeUsername(body.username);

  return {
    ...(includeParticipantId
      ? { participant_id: createParticipantId(username) }
      : {}),
    username,
    role: normalizeUserRole(body.role),
    display_name: cleanText(body.name || body.displayName),
    contact_preference: cleanText(body.contactPreference || body.contact_preference),
    mobile_number: cleanText(body.mobileNumber || body.mobile_number),
    dialect: cleanText(body.dialect),
    dialects: cleanArray(body.dialects),
    other_dialect: cleanText(body.otherDialect || body.other_dialect),
    gender: cleanText(body.gender),
    age: cleanText(body.age),
    other_language_count: cleanText(body.otherLanguageCount || body.other_language_count),
    other_languages: cleanArray(body.otherLanguages || body.other_languages),
    comfort_language: cleanText(body.comfortLanguage || body.comfort_language),
    place_of_birth: cleanText(body.placeOfBirth || body.place_of_birth),
    places_lived: cleanArray(body.placesLived || body.places_lived),
    consent_accepted: Boolean(body.consentAccepted || body.consent_accepted),
    updated_at: new Date().toISOString(),
  };
}

function profileUpdatePayload(body) {
  const payload = userPayload(body);

  delete payload.username;
  delete payload.participant_id;
  delete payload.role;
  delete payload.consent_accepted;

  return payload;
}

router.post("/users/signup", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const username = normalizeUsername(req.body.username);

    if (!username || !validateUsername(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-32 characters and only use letters, numbers, dots, underscores, or hyphens.",
      });
    }

    if (!req.body.consentAccepted && !req.body.consent_accepted) {
      return res.status(400).json({ error: "Consent must be accepted to sign up." });
    }

    const { data: existingUser, error: lookupError } = await supabase
      .from("app_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existingUser) {
      return res.status(409).json({ error: "Username is already taken." });
    }

    const { data: createdUser, error: createError } = await supabase
      .from("app_users")
      .insert(userPayload({ ...req.body, username }, { includeParticipantId: true }))
      .select("*")
      .single();

    if (isUniqueViolation(createError)) {
      return res.status(409).json({
        error: "Username or participant ID already exists. Please try again.",
      });
    }

    if (createError) throw createError;

    return res.status(201).json({ user: toClientUser(createdUser) });
  } catch (error) {
    console.error("User signup failed:", error.message, error.cause?.message || "");
    return res.status(500).json(errorResponse("Unable to create user.", error));
  }
});

router.post("/users/login", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const username = normalizeUsername(req.body.username);

    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(404).json({ error: "No user found for that username." });
    }

    return res.json({ user: toClientUser(user) });
  } catch (error) {
    console.error("User login failed:", error.message, error.cause?.message || "");
    return res.status(500).json(errorResponse("Unable to log in user.", error));
  }
});

router.get("/users/:username", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const username = normalizeUsername(req.params.username);

    if (!username || !validateUsername(username)) {
      return res.status(400).json({ error: "Valid username is required." });
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(404).json({ error: "No user found for that username." });
    }

    return res.json({ user: toClientUser(user) });
  } catch (error) {
    console.error("User lookup failed:", error.message);
    return res.status(500).json(errorResponse("Unable to fetch user.", error));
  }
});

router.patch("/users/:username", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const username = normalizeUsername(req.params.username);

    if (!username || !validateUsername(username)) {
      return res.status(400).json({ error: "Valid username is required." });
    }

    const payload = profileUpdatePayload(req.body);

    const { data: updatedUser, error } = await supabase
      .from("app_users")
      .update(payload)
      .eq("username", username)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!updatedUser) {
      return res.status(404).json({ error: "No user found for that username." });
    }

    return res.json({ user: toClientUser(updatedUser) });
  } catch (error) {
    console.error("User update failed:", error.message);
    return res.status(500).json(errorResponse("Unable to update user.", error));
  }
});

export default router;
