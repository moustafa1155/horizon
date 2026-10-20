import "server-only";
import { cookies } from "next/headers";
import { getDatabase } from "./mongodb";
import {
  cookieName,
  tokenHash,
  sessionUser,
  allows,
  sameOrigin,
} from "./authCore.mjs";
export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function authDatabase() {
  const db = await getDatabase();
  if (!globalThis.horizonAuthIndexes)
    globalThis.horizonAuthIndexes = Promise.all([
      db
        .collection("portal_users")
        .createIndex({ username: 1 }, { unique: true }),
      db
        .collection("portal_sessions")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection("portal_login_limits")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection("portal_security")
        .updateOne(
          { _id: "account-write" },
          { $setOnInsert: { version: 0 } },
          { upsert: true }
        ),
    ]).catch((e) => {
      delete globalThis.horizonAuthIndexes;
      throw e;
    });
  await globalThis.horizonAuthIndexes;
  return db;
}
export async function currentUser() {
  const token = (await cookies()).get(
    cookieName(process.env.NODE_ENV === "production")
  )?.value;
  if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
  const db = await authDatabase();
  const session = await db
    .collection("portal_sessions")
    .findOne({ _id: tokenHash(token) });
  if (!session) return null;
  return sessionUser(
    session,
    await db.collection("portal_users").findOne({ _id: session.userId })
  );
}
export async function authorize(request, page, action = "view") {
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    return { response: json({ error: "Invalid request origin." }, 403) };
  try {
    const user = await currentUser();
    if (!user) return { response: json({ error: "Please sign in." }, 401) };
    if (!allows(user, page, action))
      return { response: json({ error: "Access unavailable." }, 403) };
    return { user };
  } catch {
    return {
      response: json({ error: "Authentication service unavailable." }, 503),
    };
  }
}
export async function revoke(db, userId) {
  await db.collection("portal_sessions").deleteMany({ userId });
}
export async function audit(db, actor, action, target) {
  await db
    .collection("portal_audit")
    .insertOne({ actorId: actor, action, targetId: target, at: new Date() });
}
