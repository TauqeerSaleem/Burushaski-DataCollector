export const USER_ROLES = Object.freeze({
  VOLUNTEER: "volunteer",
  CONTENT_CONTRIBUTOR: "content_contributor",
  RESEARCHER: "researcher",
  ADMIN: "admin",
});

export const DEFAULT_USER_ROLE = USER_ROLES.VOLUNTEER;

const ROLE_ALIASES = {
  volunteer: USER_ROLES.VOLUNTEER,
  volunteers: USER_ROLES.VOLUNTEER,
  content_contributor: USER_ROLES.CONTENT_CONTRIBUTOR,
  content_contributors: USER_ROLES.CONTENT_CONTRIBUTOR,
  contentcontributor: USER_ROLES.CONTENT_CONTRIBUTOR,
  "content-contributor": USER_ROLES.CONTENT_CONTRIBUTOR,
  "content contributor": USER_ROLES.CONTENT_CONTRIBUTOR,
  "content creator": USER_ROLES.CONTENT_CONTRIBUTOR,
  "content creators": USER_ROLES.CONTENT_CONTRIBUTOR,
  researcher: USER_ROLES.RESEARCHER,
  researchers: USER_ROLES.RESEARCHER,
  admin: USER_ROLES.ADMIN,
  administrator: USER_ROLES.ADMIN,
};

export function normalizeUserRole(role) {
  if (!role) return DEFAULT_USER_ROLE;

  const key = String(role).trim().toLowerCase();
  return ROLE_ALIASES[key] || DEFAULT_USER_ROLE;
}

export function getRoleLabel(role) {
  const normalizedRole = normalizeUserRole(role);

  if (normalizedRole === USER_ROLES.CONTENT_CONTRIBUTOR) {
    return "Content Contributor";
  }

  if (normalizedRole === USER_ROLES.RESEARCHER) {
    return "Researcher";
  }

  if (normalizedRole === USER_ROLES.ADMIN) {
    return "Admin";
  }

  return "Volunteer";
}
