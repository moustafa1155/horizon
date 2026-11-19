import { ObjectId } from "mongodb";
import { weeklyHandlers } from "lib/weeklyRecords";
import { authorize, json } from "lib/serverAuth";
import { getDatabase } from "lib/mongodb";
import { readSmallJson } from "lib/requestSecurity.mjs";
import { validWeek } from "lib/timetableWeek.mjs";
import { stockCheckBranchNames } from "../../../views/admin/weeklyStockChecks/stockCheckHelpers.mjs";
import { prepareDailySales } from "../../../data/dailySales.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const legacy = weeklyHandlers(true);
export const POST = legacy.POST;
function publicReport(row) {
  if (!row) return null;
  return { id: String(row._id), branchId: row.branchId, branch: row.branch, week: row.week, manager: row.manager, notes: row.notes || "", daily: row.daily || null, cardCents: row.cardCents, cashCents: row.cashCents, costCents: Object.hasOwn(row, "costCents") ? row.costCents : row.sourceCostCents ?? null, revision: row.revision || 0, savedAt: row.savedAt };
}
async function branchFor(db, branchId, user) {
  if (typeof branchId !== "string" || !branchId || branchId.length > 120) return null;
  if (user.role !== "Admin" && user.branchId !== branchId) return null;
  return db.collection("branches").findOne({ $or: [{ _id: branchId }, ...(/^[a-f0-9]{24}$/.test(branchId) ? [{ _id: new ObjectId(branchId) }] : [])], removed: { $ne: true } });
}
const queryFor = (branch, week) => ({ week, $or: [{ branchId: String(branch._id) }, { branch: branch.name }] });
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  if (!params.has("branchId") && !params.has("week")) return legacy.GET(request);
  const access = await authorize(request, "weekly-sales-reports");
  if (access.response) return access.response;
  if (!validWeek(params.get("week"))) return json({ error: "Choose a valid week." }, 400);
  try {
    const db = await getDatabase();
    const branch = await branchFor(db, params.get("branchId"), access.user);
    if (!branch) return json({ error: "Branch is unavailable." }, 403);
    const report = await db.collection("weekly_sales_reports").findOne(queryFor(branch, params.get("week")));
    return json({ report: publicReport(report) });
  } catch { return json({ error: "Sales report could not be loaded." }, 503); }
}
export async function PUT(request) {
  const access = await authorize(request, "weekly-sales-reports", "manage");
  if (access.response) return access.response;
  let body, amounts;
  try {
    body = await readSmallJson(request, 32768);
    if (!body || !validWeek(body.week) || !Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.notes !== "string" || body.notes.length > 2000) throw Error("Invalid report details.");
    amounts = prepareDailySales(body.daily);
  } catch (error) { return json({ error: error.message || "Invalid daily sales." }, 400); }
  try {
    const db = await getDatabase();
    const branch = await branchFor(db, body.branchId, access.user);
    if (!branch) return json({ error: "Select your assigned active branch." }, 403);
    if (!stockCheckBranchNames([branch], body.week).length) return json({ error: "This branch was not operating during that week." }, 400);
    const collection = db.collection("weekly_sales_reports");
    await collection.createIndex({ branch: 1, week: 1 }, { unique: true, name: "branch_week_unique" });
    await collection.createIndex({ branchId: 1, week: 1 }, { unique: true, partialFilterExpression: { branchId: { $type: "string" } }, name: "branch_id_week_unique" });
    const existing = await collection.findOne(queryFor(branch, body.week));
    if ((existing?.revision || 0) !== body.revision) return json({ error: "This report changed since you opened it. Reload before saving again." }, 409);
    const daily = amounts.daily.map(row => {
      const previous = existing?.daily?.find(item => item.day === row.day);
      return { ...(previous ? { ...previous } : {}), ...row };
    });
    const record = { branchId: String(branch._id), branch: branch.name, week: body.week, manager: access.user.role === "Branch Manager" ? access.user.name : existing?.manager || access.user.name, daily, cardCents: amounts.cardCents, cashCents: amounts.cashCents, costCents: amounts.costCents, notes: body.notes.trim(), revision: body.revision + 1, savedAt: new Date().toISOString(), updatedBy: access.user.id };
    let id;
    if (existing) {
      const result = await collection.updateOne({ _id: existing._id, ...(body.revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision: body.revision }) }, { $set: record });
      if (!result.matchedCount) return json({ error: "This report changed. Reload before saving again." }, 409);
      id = existing._id;
    } else id = (await collection.insertOne({ ...record, submittedBy: access.user.id })).insertedId;
    return json({ report: publicReport({ ...record, _id: id }) });
  } catch (error) { return json({ error: error.code === 11000 ? "This report was just saved elsewhere. Reload before editing." : "Daily sales could not be saved." }, error.code === 11000 ? 409 : 503); }
}
