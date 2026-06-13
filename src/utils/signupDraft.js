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
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function draftToSignupPayload(draft) {
  return {
    username: draft.username,
    name: draft.name,
    age: draft.age,
    gender: draft.gender,
    dialect: draft.dialect,
    otherLanguages: parseCommaList(draft.otherLanguages),
    placeOfBirth: draft.placeOfBirth,
    placesLived: parseCommaList(draft.placesLived),
    role: "volunteer",
    consentAccepted: true,
  };
}
