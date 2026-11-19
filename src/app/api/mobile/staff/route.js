import { allows, branchFilter, tokenHash } from "lib/authCore.mjs";
import { authDatabase, json, userForSession } from "lib/serverAuth";
import { employeeCollection } from "lib/mongodb";
export const runtime = "nodejs";

function bearer(request) {
  return /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") || "")?.[1];
}
export async function GET(request) {
  try {
    const user = await userForSession(bearer(request), "mobile-staff");
    if (!user) return json({ error: "Please sign in again." }, 401);
    if (!allows(user, "employees")) return json({ error: "Access unavailable." }, 403);
    const records = await (await employeeCollection())
      .find({ ...branchFilter(user), removed: { $ne: true } }, {
        projection: { fullName: 1, phoneNumber: 1, email: 1, branchId: 1 },
      }).sort({ fullName: 1 }).limit(1000).toArray();
    return json({ employees: records.map(({ _id, ...record }) => ({ ...record, id: String(_id) })) });
  } catch {
    return json({ error: "Staff details could not be loaded." }, 503);
  }
}
export async function DELETE(request) {
  const token = bearer(request);
  if (!token) return json({ error: "Please sign in again." }, 401);
  try {
    await (await authDatabase()).collection("portal_sessions")
      .deleteOne({ _id: tokenHash(token), channel: "mobile-staff" });
    return json({ ok: true });
  } catch {
    return json({ error: "Sign-out is temporarily unavailable." }, 503);
  }
}
