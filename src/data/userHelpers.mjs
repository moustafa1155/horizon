export const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/;
export const USER_STORAGE_KEY = "horizon.users.v1";
export const SESSION_KEY = "horizon.user-session.v1";
export const PAGES = [
  { key: "default", label: "Main Dashboard", editable: false },
  { key: "employees", label: "Employees", editable: true },
  { key: "employee-files", label: "Employee Files", editable: true },
  { key: "weekly-orders", label: "Weekly Orders", editable: true },
  { key: "weekly-stock-checks", label: "Weekly Stock Checks", editable: true },
  {
    key: "weekly-sales-reports",
    label: "Weekly Sales Reports",
    editable: true,
  },
  { key: "weekly-staff-timetables", label: "Weekly Staff Timetables", editable: true },
  { key: "branches", label: "Branches", editable: true },
  { key: "users", label: "Users & Permissions", editable: true },
];
export const ROLES = ["Admin", "Branch Manager", "Employee"];
export function rolePermissions(role) {
  return Object.fromEntries(
    PAGES.map((page) => {
      if (role === "Admin")
        return [page.key, { view: true, manage: page.editable }];
      const view =
        role === "Branch Manager"
          ? ["employees","weekly-sales-reports","weekly-orders","weekly-staff-timetables"].includes(page.key)
          : page.key === "weekly-stock-checks";
      const manage =
        role === "Branch Manager"
          ? ["employees", "weekly-orders", "weekly-sales-reports", "weekly-staff-timetables"].includes(page.key)
          : page.key === "weekly-stock-checks";
      return [page.key, { view, manage }];
    })
  );
}
export function canAccess(user, page, action = "view") {
  if (!user || user.removed || !PAGES.some((entry) => entry.key === page))
    return false;
  if (user.role === "Employee" && page !== "weekly-stock-checks") return false;
  if (user.role === "Branch Manager") { const grant=rolePermissions("Branch Manager")[page]; return !!grant?.view && (action === "view" || !!grant.manage); }
  if (page === "users") return user.role === "Admin";
  if (user.role === "Admin") return true;
  return (
    !!user.permissions?.[page]?.view &&
    (action === "view" || !!user.permissions?.[page]?.manage)
  );
}
export function firstPage(user) {
  return PAGES.find((page) => canAccess(user, page.key))?.key || "no-access";
}
export function validateUser(draft, users, editingId = null) {
  if (!draft.name.trim()) return "Enter the user's name.";
  if (!USERNAME_PATTERN.test(draft.username.trim()))
    return "Use 3–32 characters: letters, numbers, dots, underscores or hyphens.";
  if (!ROLES.includes(draft.role)) return "Select a valid role.";
  if (
    users.some(
      (user) =>
        user.id !== editingId &&
        user.username.toLowerCase() === draft.username.trim().toLowerCase()
    )
  )
    return "This username already exists, including removed users. Restore the existing user instead.";
  if (
    (!editingId || draft.password) &&
    (draft.password.length < 12 || draft.password.length > 128)
  )
    return "Use a password between 12 and 128 characters.";
  return "";
}
export function validateChange(
  users,
  actor,
  target,
  nextRole,
  removing = false
) {
  if (actor?.role !== "Admin" || actor.removed)
    return "Only admins can manage users.";
  if (target?.id === actor.id && (removing || nextRole !== "Admin"))
    return "You cannot remove your own account or change your own admin role.";
  if (
    target?.role === "Admin" &&
    !target.removed &&
    (removing || nextRole !== "Admin") &&
    users.filter((user) => !user.removed && user.role === "Admin").length <= 1
  )
    return "Keep at least one active admin account.";
  return "";
}
const hex = (bytes) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
async function derive(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600000 },
        key,
        256
      )
    )
  );
}
export async function passwordRecord(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: hex(salt), hash: await derive(password, salt) };
}
export async function verifyPassword(password, credentials) {
  const salt = new Uint8Array(
    credentials.salt.match(/.{2}/g).map((value) => parseInt(value, 16))
  );
  const actual = await derive(password, salt);
  let difference = 0;
  for (let i = 0; i < actual.length; i++)
    difference |= actual.charCodeAt(i) ^ credentials.hash.charCodeAt(i);
  return difference === 0;
}
export function loadUsers(storage) {
  const users = JSON.parse(storage.getItem(USER_STORAGE_KEY) || "[]");
  if (!Array.isArray(users)) throw new Error("Invalid users");
  // Preserve existing local accounts when switching from email login.
  const taken = new Set(
    users
      .filter((u) => typeof u?.username === "string")
      .map((u) => u.username.toLowerCase())
  );
  for (const user of users) {
    if (user && user.username === undefined && typeof user.email === "string") {
      let base = user.email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .replace(/^[^a-zA-Z0-9]+/, "")
        .slice(0, 24);
      if (base.length < 3) base = "user";
      let username = base;
      let suffix = 2;
      while (taken.has(username.toLowerCase()))
        username = base + "-" + suffix++;
      user.username = username.toLowerCase();
      taken.add(user.username);
      delete user.email;
    }
  }
  const usernames = new Set();
  const ids = new Set();
  for (const user of users) {
    if (
      !user ||
      typeof user.id !== "string" ||
      !user.id ||
      typeof user.name !== "string" ||
      !user.name.trim() ||
      typeof user.username !== "string" ||
      !USERNAME_PATTERN.test(user.username) ||
      !ROLES.includes(user.role) ||
      typeof user.removed !== "boolean" ||
      !/^[a-f0-9]{32}$/.test(user.credentials?.salt || "") ||
      !/^[a-f0-9]{64}$/.test(user.credentials?.hash || "") ||
      !user.permissions ||
      usernames.has(user.username.toLowerCase()) ||
      ids.has(user.id)
    )
      throw new Error("Invalid user record");
    if (!user.permissions["weekly-staff-timetables"]) user.permissions["weekly-staff-timetables"] = rolePermissions(user.role)["weekly-staff-timetables"];
    for (const page of PAGES) {
      const grant = user.permissions[page.key];
      if (
        !grant ||
        typeof grant.view !== "boolean" ||
        typeof grant.manage !== "boolean" ||
        (grant.manage && !grant.view)
      )
        throw new Error("Invalid permissions");
    }
    ids.add(user.id);
    usernames.add(user.username.toLowerCase());
  }
  if (
    users.length &&
    !users.some((user) => user.role === "Admin" && !user.removed)
  )
    throw new Error("No active admin");
  return users;
}
