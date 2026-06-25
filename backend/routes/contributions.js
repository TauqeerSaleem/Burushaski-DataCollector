import express from "express";
import { hasServiceRoleKey, hasSupabaseConfig, supabase } from "../supabaseClient.js";
import { normalizeUserRole, USER_ROLES } from "../utils/roles.js";

const router = express.Router();

const VALID_ROLES = new Set([
  USER_ROLES.CONTENT_CONTRIBUTOR,
  USER_ROLES.RESEARCHER,
]);

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function requireServiceRole(res) {
  if (!hasSupabaseConfig || !supabase) {
    res.status(500).json({
      error: "Contributions API requires Supabase backend environment variables.",
    });
    return false;
  }

  if (hasServiceRoleKey) return true;

  res.status(500).json({
    error: "Contributions API requires SUPABASE_SERVICE_ROLE_KEY on the backend.",
  });
  return false;
}

function contributionToClient(row) {
  return {
    id: row.id,
    username: row.username,
    role: normalizeUserRole(row.role),
    contentType: row.content_type,
    mediaUrl: row.media_url || "",
    description: row.description || "",
    languageNotes: row.language_notes || "",
    speakerMetadata: row.speaker_metadata || "",
    turnTakingNotes: row.turn_taking_notes || "",
    status: row.status || "pending",
    createdAt: row.created_at,
  };
}

function contributionPayload(body) {
  const role = normalizeUserRole(body.role);

  return {
    username: cleanText(body.username),
    role,
    content_type: cleanText(body.content_type || body.contentType),
    media_url: cleanText(body.media_url || body.mediaUrl),
    description: cleanText(body.description),
    language_notes: cleanText(body.language_notes || body.languageNotes),
    speaker_metadata: cleanText(body.speaker_metadata || body.speakerMetadata),
    turn_taking_notes: cleanText(body.turn_taking_notes || body.turnTakingNotes),
  };
}

router.post("/contributions", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const payload = contributionPayload(req.body);

    if (!payload.username || !payload.role || !payload.content_type || !payload.media_url) {
      return res.status(400).json({
        error: "Missing required fields: username, role, content_type, and media_url.",
      });
    }

    if (!VALID_ROLES.has(payload.role)) {
      return res.status(400).json({
        error: "Contributions are only available for content contributors and researchers.",
      });
    }

    const { data, error } = await supabase
      .from("contributions")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({ contribution: contributionToClient(data) });
  } catch (error) {
    console.error("Contribution create failed:", error.message);
    return res.status(500).json({ error: "Unable to submit contribution." });
  }
});

router.get("/contributions/:username", async (req, res) => {
  try {
    if (!requireServiceRole(res)) return;

    const username = cleanText(req.params.username);

    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }

    const { data, error } = await supabase
      .from("contributions")
      .select("*")
      .eq("username", username)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ contributions: (data || []).map(contributionToClient) });
  } catch (error) {
    console.error("Contribution lookup failed:", error.message);
    return res.status(500).json({ error: "Unable to load contributions." });
  }
});

export default router;
