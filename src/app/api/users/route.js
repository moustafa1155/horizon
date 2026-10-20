import { ObjectId } from "mongodb";
import { authorize, authDatabase, json } from "lib/serverAuth";
import { publicUser, hashPassword } from "lib/authCore.mjs";
import { validateUser, validateChange } from "../../../data/userHelpers.mjs";
import { readSmallJson } from "lib/requestSecurity.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
export async function GET(request) {
  const access = await authorize(request, "users");
  if (access.response) return access.response;
  try {
    return json({
      users: (
        await (await authDatabase())
          .collection("portal_users")
          .find({})
          .sort({ name: 1 })
          .toArray()
      ).map(publicUser),
    });
  } catch {
    return json({ error: "Users could not be loaded." }, 503);
  }
}
// Serialize account changes in a transaction so two admins cannot remove each other concurrently.
async function mutate(access, operation) {
  const db = await authDatabase();
  const session = db.client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const options = { session };
        await db
          .collection("portal_security")
          .updateOne(
            { _id: "account-write" },
            { $inc: { version: 1 } },
            { upsert: true, ...options }
          );
        const rows = await db
          .collection("portal_users")
          .find({}, options)
          .toArray();
        const users = rows.map(publicUser);
        const actor = users.find((u) => u.id === access.user.id);
        if (!actor || actor.removed || actor.role !== "Admin")
          fail("Please sign in as an admin.", 403);
        return operation(db, options, users, actor);
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }
    );
  } finally {
    await session.endSession();
  }
}
async function recordChange(db, options, actor, id, action) {
  await db.collection("portal_sessions").deleteMany({ userId: id }, options);
  await db
    .collection("portal_audit")
    .insertOne(
      { actorId: new ObjectId(actor.id), targetId: id, action, at: new Date() },
      options
    );
}
export async function POST(request) {
  return save(request, false);
}
export async function PUT(request) {
  return save(request, true);
}
async function save(request, editing) {
  const access = await authorize(request, "users", "manage");
  if (access.response) return access.response;
  let body;
  try {
    body = await readSmallJson(request);
  } catch {
    return json({ error: "Invalid user details." }, 400);
  }
  if (
    !body ||
    typeof body.name !== "string" ||
    body.name.length > 120 ||
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    body.password.length > 128 ||
    typeof body.role !== "string" ||
    typeof body.branchId !== "string" ||
    body.branchId.length > 120 ||
    (editing && !/^[a-f0-9]{24}$/.test(body.id || ""))
  )
    return json({ error: "Invalid user details." }, 400);
  try {
    const basic = validateUser(body, [], editing ? body.id : null);
    if (basic) return json({ error: basic }, 400);
    const credentials = body.password
      ? await hashPassword(body.password)
      : null;
    await mutate(access, async (db, options, users, actor) => {
      const target = editing ? users.find((u) => u.id === body.id) : null;
      if (editing && !target) fail("User no longer exists.", 404);
      const error =
        validateUser(body, users, editing ? body.id : null) ||
        validateChange(users, actor, target, body.role);
      if (error) fail(error);
      if (body.role !== "Admin") {
        const branch = body.branchId
          ? await db
              .collection("branches")
              .findOne(
                {
                  $or: [
                    { _id: body.branchId },
                    ...(/^[a-f0-9]{24}$/.test(body.branchId)
                      ? [{ _id: new ObjectId(body.branchId) }]
                      : []),
                  ],
                  removed: { $ne: true },
                },
                options
              )
          : null;
        if (!branch) fail("Assign this user to an active company branch.");
      }
      const record = {
        name: body.name.trim(),
        username: body.username.trim().toLowerCase(),
        role: body.role,
        branchId: body.role === "Admin" ? "" : body.branchId,
        removed: target?.removed || false,
        updatedAt: new Date(),
      };
      if (credentials) record.credentials = credentials;
      let id;
      if (editing) {
        id = new ObjectId(body.id);
        await db
          .collection("portal_users")
          .updateOne(
            { _id: id },
            { $set: record, $inc: { authVersion: 1 } },
            options
          );
      } else {
        record.authVersion = 1;
        record.createdAt = new Date();
        id = (await db.collection("portal_users").insertOne(record, options))
          .insertedId;
      }
      await recordChange(
        db,
        options,
        actor,
        id,
        editing ? "update-user" : "create-user"
      );
    });
    return json({ ok: true }, editing ? 200 : 201);
  } catch (error) {
    return json(
      {
        error:
          error.code === 11000
            ? "This username already exists."
            : error.status
            ? error.message
            : "User could not be saved.",
      },
      error.code === 11000 ? 409 : error.status || 503
    );
  }
}
export async function PATCH(request) {
  const access = await authorize(request, "users", "manage");
  if (access.response) return access.response;
  let body;
  try {
    body = await readSmallJson(request);
  } catch {
    return json({ error: "Invalid user details." }, 400);
  }
  if (
    !/^[a-f0-9]{24}$/.test(body?.id || "") ||
    typeof body.removed !== "boolean"
  )
    return json({ error: "Invalid user details." }, 400);
  try {
    await mutate(access, async (db, options, users, actor) => {
      const target = users.find((u) => u.id === body.id);
      if (!target) fail("User no longer exists.", 404);
      const error = validateChange(
        users,
        actor,
        target,
        target.role,
        body.removed
      );
      if (error) fail(error);
      const id = new ObjectId(body.id);
      await db
        .collection("portal_users")
        .updateOne(
          { _id: id },
          {
            $set: { removed: body.removed, updatedAt: new Date() },
            $inc: { authVersion: 1 },
          },
          options
        );
      await recordChange(
        db,
        options,
        actor,
        id,
        body.removed ? "disable-user" : "restore-user"
      );
    });
    return json({ ok: true });
  } catch (error) {
    return json(
      { error: error.status ? error.message : "User could not be updated." },
      error.status || 503
    );
  }
}
