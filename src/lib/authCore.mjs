import { randomBytes, createHash, pbkdf2, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { canAccess, rolePermissions } from "../data/userHelpers.mjs";
const derive = promisify(pbkdf2);
export const SESSION_SECONDS = 8 * 60 * 60;
export const cookieName = (production) =>
  production ? "__Host-horizon-session" : "horizon-session";
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export function newSession() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    hash: tokenHash(token),
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
  };
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return {
    salt,
    hash: (
      await derive(password, Buffer.from(salt, "hex"), 600000, 32, "sha256")
    ).toString("hex"),
  };
}
export async function checkPassword(password, record) {
  if (
    !/^[a-f0-9]{32}$/.test(record?.salt || "") ||
    !/^[a-f0-9]{64}$/.test(record?.hash || "")
  )
    return false;
  const actual = await derive(
    password,
    Buffer.from(record.salt, "hex"),
    600000,
    32,
    "sha256"
  );
  return timingSafeEqual(actual, Buffer.from(record.hash, "hex"));
}
export function publicUser(record) {
  return {
    id: String(record._id),
    name: record.name,
    username: record.username,
    role: record.role,
    branchId: record.branchId || "",
    removed: !!record.removed,
    permissions: rolePermissions(record.role),
  };
}
export function sessionUser(session, record, now = new Date()) {
  if (
    !session ||
    !record ||
    record.removed ||
    session.expiresAt <= now ||
    session.version !== record.authVersion
  )
    return null;
  return publicUser(record);
}
export function allows(user, page, action = "view") {
  return (
    ["Admin", "Branch Manager", "Employee"].includes(user?.role) &&
    canAccess(user, page, action)
  );
}
export function branchFilter(user) {
  return user.role === "Admin"
    ? {}
    : { branchId: user.branchId || "__unassigned__" };
}

function configuredOrigin(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function sameOrigin(request, environment = process.env) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin === "null" ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return false;
  // Render terminates HTTPS before forwarding to Next.js. Trust platform/configuration
  // origins, never a caller-supplied Host or forwarded-host header.
  const configured = [environment.APP_ORIGIN, environment.RENDER_EXTERNAL_URL];
  const allowed = configured.map(configuredOrigin).filter(Boolean);
  if (!configured.some((value) => value?.trim()))
    allowed.push(new URL(request.url).origin);
  return allowed.includes(origin);
}
