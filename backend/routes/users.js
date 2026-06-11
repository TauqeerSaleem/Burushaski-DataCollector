import express from "express";
import { supabase } from "../server.js";
import { normalizeUserRole } from "../utils/roles.js";

const router = express.Router();

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function cleanArray(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(",");
  return items.map(cleanText).filter(Boolean);
}

function normalizeUsername(username) {
  const value = cleanText(username);
  if (!value) return null;
  return value;
}

function validateUsername(username) {
  return USERNAME_PATTERN.test(username);
}

async function createNextParticipantId() {
  const { data } = await supabase
    .from("app_users")
    .select("participant_id")
    .like("participant_id", "P-%");

  const nums = (data || [])
    .map((r) => parseInt(r.participant_id.slice(2), 10))
    .filter((n) => !isNaN(n));

  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `P-${String(max + 1).padStart(3, "0")}`;
}

function toClientUser(row) {
  return {
    id: row.id,
    participantId: row.participant_id,
    username: row.username,
    role: normalizeUserRole(row.role),
    name: row.display_name || "",
    dialect: row.dialect || "",
    gender: row.gender || "",
    age: row.age || "",
    otherLanguages: row.other_languages || [],
    placeOfBirth: row.place_of_birth || "",
    placesLived: row.places_lived || [],
    consentAccepted: Boolean(row.consent_accepted),
  };
}

function userPayload(body) {
  const username = normalizeUsername(body.username);

  return {
    username,
    role: normalizeUserRole(body.role),
    display_name: cleanText(body.name || body.displayName),
    dialect: cleanText(body.dialect),
    gender: cleanText(body.gender),
    age: cleanText(body.age),
    other_languages: cleanArray(body.otherLanguages || body.other_languages),
    place_of_birth: cleanText(body.placeOfBirth || body.place_of_birth),
    places_lived: cleanArray(body.placesLived || body.places_lived),
    consent_accepted: Boolean(body.consentAccepted || body.consent_accepted),
    updated_at: new Date().toISOString(),
  };
}

router.post("/users/signup", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);

    if (!username || !validateUsername(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-32 characters and only use letters, numbers, dots, underscores, or hyphens.",
      });
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

    const participantId = await createNextParticipantId();
    const { data: createdUser, error: createError } = await supabase
      .from("app_users")
      .insert({ ...userPayload({ ...req.body, username }), participant_id: participantId })
      .select("*")
      .single();

    if (createError) throw createError;

    return res.status(201).json({ user: toClientUser(createdUser) });
  } catch (error) {
    console.error("User signup failed:", error.message);
    return res.status(500).json({ error: "Unable to create user." });
  }
});

router.post("/users/login", async (req, res) => {
  try {
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
    console.error("User login failed:", error.message);
    return res.status(500).json({ error: "Unable to log in user." });
  }
});

router.get("/users/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);

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
    return res.status(500).json({ error: "Unable to fetch user." });
  }
});

router.patch("/users/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);

    const payload = userPayload(req.body);
    delete payload.username;

    const { data: updatedUser, error } = await supabase
      .from("app_users")
      .update(payload)
      .eq("username", username)
      .select("*")
      .single();

    if (error) throw error;

    return res.json({ user: toClientUser(updatedUser) });
  } catch (error) {
    console.error("User update failed:", error.message);
    return res.status(500).json({ error: "Unable to update user." });
  }
});

export default router;
