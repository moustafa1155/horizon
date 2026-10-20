import { cookies } from "next/headers";
import { authDatabase, json } from "lib/serverAuth";
import { cookieName, tokenHash, sameOrigin } from "lib/authCore.mjs";
export async function POST(request) {
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  try {
    const jar = await cookies();
    const name = cookieName(process.env.NODE_ENV === "production");
    const token = jar.get(name)?.value;
    if (/^[a-f0-9]{64}$/.test(token || ""))
      await (await authDatabase())
        .collection("portal_sessions")
        .deleteOne({ _id: tokenHash(token) });
    jar.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return json({ ok: true });
  } catch {
    return json({ error: "Sign-out failed. Please try again." }, 503);
  }
}
