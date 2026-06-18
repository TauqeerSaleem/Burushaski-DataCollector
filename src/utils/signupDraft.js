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

function formatPlace(place) {
  if (!place) return "";
  if (typeof place === "string") return place;

  const city = place.city?.trim();
  const country = place.country?.trim();

  return [city, country].filter(Boolean).join(", ");
}

export function draftToSignupPayload(draft) {
  return {
    username: draft.username,
    name: draft.name || draft.username,
    age: draft.ageGroup,
    gender: draft.gender,
    dialect: draft.dialect,
    dialects: draft.dialects || [],
    otherDialect: draft.otherDialect,
    otherLanguages: parseCommaList(draft.otherLangs),
    otherLanguageCount: draft.numOtherLangs,
    comfortLanguage: draft.comfortLang,
    contactPreference: draft.contactPref,
    email: draft.email,
    mobileNumber: draft.mobile,
    placeOfBirth: formatPlace(draft.birthplace),
    placesLived: (draft.placesLived || []).map(formatPlace).filter(Boolean),
    role: draft.role,
    consentAccepted: true,
  };
}
