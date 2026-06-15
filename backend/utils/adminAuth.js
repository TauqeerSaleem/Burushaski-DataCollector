import crypto from "node:crypto";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TOKEN_VERSION = "v1";
const PASSWORD_HASH_PREFIX = "scrypt";

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function sign(value) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET or ADMIN_API_KEY is required for admin sessions.");
  }

  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function masterAdminUsername() {
  return cleanText(process.env.MASTER_ADMIN_USERNAME || "master-admin");
}

export function hasMasterAdminPassword() {
  return Boolean(cleanText(process.env.MASTER_ADMIN_PASSWORD));
}

export function isMasterAdminUsername(username) {
  return cleanText(username).toLowerCase() === masterAdminUsername().toLowerCase();
}

export function verifyMasterAdmin(username, password) {
  const expectedPassword = cleanText(process.env.MASTER_ADMIN_PASSWORD);

  if (!expectedPassword || !isMasterAdminUsername(username)) return false;

  return timingSafeEqualText(cleanText(password), expectedPassword);
}

export function hashPassword(password) {
  const cleanPassword = cleanText(password);

  if (cleanPassword.length < 10) {
    throw new Error("Admin password must be at least 10 characters.");
  }

  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(cleanPassword, salt, 64).toString("base64url");

  return `${PASSWORD_HASH_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const cleanPassword = cleanText(password);
  const parts = String(passwordHash || "").split("$");

  if (parts.length !== 3 || parts[0] !== PASSWORD_HASH_PREFIX) return false;

  const [, salt, expectedHash] = parts;
  const actualHash = crypto.scryptSync(cleanPassword, salt, 64).toString("base64url");

  return timingSafeEqualText(actualHash, expectedHash);
}

export function createAdminToken(admin) {
  const now = Date.now();
  const header = base64UrlJson({ alg: "HS256", typ: "JWT", v: TOKEN_VERSION });
  const payload = base64UrlJson({
    sub: admin.id,
    username: admin.username,
    displayName: admin.displayName || admin.username,
    isMaster: Boolean(admin.isMaster),
    iat: now,
    exp: now + SESSION_TTL_MS,
  });
  const unsignedToken = `${header}.${payload}`;

  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifyAdminToken(token) {
  const parts = String(token || "").split(".");

  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const unsignedToken = `${header}.${payload}`;
  const expectedSignature = sign(unsignedToken);

  if (!timingSafeEqualText(signature, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (!decoded.exp || decoded.exp < Date.now()) return null;

    return {
      id: decoded.sub,
      username: decoded.username,
      displayName: decoded.displayName || decoded.username,
      isMaster: Boolean(decoded.isMaster),
    };
  } catch {
    return null;
  }
}

export function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}
