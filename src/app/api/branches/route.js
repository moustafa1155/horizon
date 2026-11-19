import { currentUser, authorize, json } from "lib/serverAuth";
import { ObjectId } from "mongodb";
import { getDatabase } from "lib/mongodb";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Please sign in." }, 401);
    const query =
      user.role === "Admin"
        ? {}
        : {
            $or: [
              { _id: user.branchId || { $in: [] } },
              ...(/^[a-f0-9]{24}$/.test(user.branchId || "")
                ? [{ _id: new ObjectId(user.branchId) }]
                : []),
            ],
          };
    const rows = await (
      await getDatabase()
    )
      .collection("branches")
      .find(query, {
        projection: { name: 1, type: 1, startDate: 1, endDate: 1, removed: 1, revision: 1 },
      })
      .toArray();
    return json({
      branches: rows.map(({ _id, ...b }) => ({
        ...b,
        id: String(_id),
        type: b.type || "",
        startDate: b.startDate || "",
        endDate: b.endDate || "",
        removed: !!b.removed,
      })),
    });
  } catch {
    return json({ error: "Database branches could not be loaded." }, 503);
  }
}

import { validateBranch } from "../../../data/branches.mjs";
import { readSmallJson } from "lib/requestSecurity.mjs";
export async function POST(request) { return save(request, false); }
export async function PUT(request) { return save(request, true); }
async function save(request, editing) {
  const access = await authorize(request, "branches", "manage");
  if (access.response) return access.response;
  if (access.user.role !== "Admin") return json({ error: "Only admins can change company branches." }, 403);
  let body;
  try { body = await readSmallJson(request); } catch { return json({ error: "Invalid branch." }, 400); }
  if (!body || !["name","type","startDate","endDate"].every(key => typeof body[key] === "string") || typeof body.removed !== "boolean" || (editing && (typeof body.id !== "string" || body.id.length > 120 || !Number.isSafeInteger(body.revision) || body.revision < 0))) return json({ error: "Invalid branch details." }, 400);
  try {
    const collection = (await getDatabase()).collection("branches");
    const rows = await collection.find({}).toArray();
    const records = rows.map(row => ({ ...row, id: String(row._id) }));
    const validation = validateBranch(body, records, editing ? body.id : null);
    const original = editing ? rows.find(row => String(row._id) === body.id) : null;
    // Imported branches with unknown type may still be removed/restored without inventing dates or type.
    const unchangedImported = original && !original.type && body.type === "" && ["name","startDate","endDate"].every(key => (original[key] || "") === body[key]);
    if (validation && !unchangedImported) return json({ error: validation }, 400);
    await collection.createIndex({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 }, name: "branch_name_unique" });
    const record = { name: body.name.trim(), type: body.type, startDate: body.startDate, endDate: body.endDate, removed: body.removed, updatedAt: new Date() };
    if (editing) {
      if (!original) return json({ error: "Branch no longer exists." }, 404);
      const result = await collection.updateOne({ _id: original._id, ...(body.revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision: body.revision }) }, { $set: record, $inc: { revision: 1 } });
      if (!result.matchedCount) return json({ error: "This branch changed. Refresh before saving again." }, 409);
    } else { await collection.insertOne({ ...record, revision: 1, createdAt: new Date() }); }
    return json({ ok: true }, editing ? 200 : 201);
  } catch (error) { return json({ error: error.code === 11000 ? "This branch name already exists." : "Branch could not be saved." }, error.code === 11000 ? 409 : 503); }
}
