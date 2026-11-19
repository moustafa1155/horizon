import "server-only";
import { cookies } from "next/headers";
import { authDatabase, json, audit } from "lib/serverAuth";
import {
  sameOrigin,
  tokenHash,
  checkPassword,
  newSession,
  cookieName,
  SESSION_SECONDS,
  publicUser,
  allows,
} from "lib/authCore.mjs";
import { readSmallJson } from "lib/requestSecurity.mjs";
export async function signIn(request, mobile = false) {
  if (mobile && !/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || ""))
    return json({ error: "Expected JSON credentials." }, 415);
  if (!mobile && !sameOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  let body;
  try {
    body = await readSmallJson(request);
  } catch {
    return json({ error: "Invalid login request." }, 400);
  }
  if (
    typeof body?.username !== "string" ||
    typeof body?.password !== "string" ||
    body.username.length > 32 ||
    body.password.length > 128
  )
    return json({ error: "Username or password is incorrect." }, 400);
  try {
    const db = await authDatabase();
    const username = body.username.trim().toLowerCase();
    const now = Date.now();
    for (const [key, windowMs, max] of [
      ["all", 60000, 100],
      [tokenHash(username), 900000, 10],
    ]) {
      const bucket = Math.floor(now / windowMs);
      const limit = await db
        .collection("portal_login_limits")
        .findOneAndUpdate(
          { _id: key + ":" + bucket },
          {
            $inc: { count: 1 },
            $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) },
          },
          { upsert: true, returnDocument: "after" }
        );
      if (limit.count > max)
        return json(
          { error: "Too many login attempts. Please try again later." },
          429
        );
    }
    const account = await db.collection("portal_users").findOne({ username });
    const dummy = { salt: "0".repeat(32), hash: "0".repeat(64) };
    const valid = await checkPassword(
      body.password,
      account?.credentials || dummy
    );
    if (!valid || !account || account.removed)
      return json({ error: "Username or password is incorrect." }, 401);
    const user = publicUser(account);
    if (mobile && !allows(user, "employees"))
      return json({ error: "This account cannot access Staff Details." }, 403);
    const jar = mobile ? null : await cookies();
    const old = jar?.get(
      cookieName(process.env.NODE_ENV === "production")
    )?.value;
    if (/^[a-f0-9]{64}$/.test(old || ""))
      await db.collection("portal_sessions").deleteOne({ _id: tokenHash(old) });
    const session = newSession();
    await db
      .collection("portal_sessions")
      .insertOne({
        _id: session.hash,
        userId: account._id,
        ...(mobile ? { channel: "mobile-staff" } : {}),
        version: account.authVersion,
        expiresAt: session.expiresAt,
        createdAt: new Date(),
      });
    await audit(db, account._id, "login", account._id);
    if (mobile) return json({ user, token: session.token });
    jar.set(cookieName(process.env.NODE_ENV === "production"), session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return json({ user });
  } catch {
    return json({ error: "Sign-in is temporarily unavailable." }, 503);
  }
}
