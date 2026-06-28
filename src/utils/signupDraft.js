const SIGNUP_DRAFT_KEY = "burushaski_signup_draft";

export function saveSignupDraft(draft) {
  sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
}

export function loadSignupDraft() {
  const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
    return null;
  }
}

export function clearSignupDraft() {
  sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

export function validateUsername(username) {
  return USERNAME_PATTERN.test(username.trim());
}

export function parseCommaList(value) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Preserves the full structured shape of a place object.
// Returns null for empty/missing input.
function normalizePlace(place) {
  if (!place) return null;

  if (typeof place === "string") {
    const trimmed = place.trim();
    return trimmed ? { country: "", city: trimmed, locality: "", timeLived: "" } : null;
  }

  const country = (place.country || "").trim();
  const city = (place.city || "").trim();
  const locality = (place.locality || "").trim();
  const timeLived = (place.timeLived || "").trim();

  if (!country && !city && !locality && !timeLived) return null;

  return { country, city, locality, timeLived };
}

export function draftToSignupPayload(draft) {
  // Build otherLanguages: take selected langs minus "other",
  // then append any free-text entries from the "other" field.
  const otherLanguages = [
    ...(draft.otherLangs || []).filter((l) => l !== "other"),
    ...parseCommaList(draft.otherLangsOther),
  ];

  return {
    username: draft.username,
    name: draft.name || draft.username,
    age: draft.age,
    gender: draft.gender,
    // dialect is a single value: "Hunza" | "Nagar" | "Yasin"
    dialect: draft.dialect || null,
    dialects: draft.dialects || [],
    otherDialect: draft.otherDialect || null,
    otherLanguages,
    comfortLanguage: draft.comfortLang || null,
    contactPreference: draft.contactPref || null,
    email: draft.email || null,
    mobileNumber: draft.mobile || null,
    // Structured objects: { country, city, locality, timeLived }
    // Backend (users.js) will JSON.stringify these before storing,
    // so the full breakdown survives the text/text[] column constraint.
    placeOfOrigin: normalizePlace(draft.placeOfOrigin),
    placesLived: (draft.placesLived || [])
      .map(normalizePlace)
      .filter(Boolean),
    role: draft.role,
    consentAccepted: true,
  };
}