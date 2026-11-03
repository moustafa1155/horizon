import { ObjectId } from "mongodb";
import { authorize, json } from "lib/serverAuth";
import { getDatabase } from "lib/mongodb";
import { branchFilter } from "lib/authCore.mjs";
import { readSmallJson } from "lib/requestSecurity.mjs";
import { stockCheckBranchNames, validateStockCheck } from "../../../views/admin/weeklyStockChecks/stockCheckHelpers.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const output = ({ _id, submittedBy, ...record }) => ({ ...record, id: String(_id) });
export async function GET(request) {
  const access = await authorize(request, "weekly-stock-checks");
  if (access.response) return access.response;
  try {
    const db = await getDatabase();
    const checks = await db.collection("weekly_stock_checks").find(branchFilter(access.user)).sort({ recordedAt: -1 }).limit(1000).toArray();
    return json({ checks: checks.map(output) });
  } catch { return json({ error: "Stock checks could not be loaded." }, 503); }
}
export async function POST(request) {
  const access = await authorize(request, "weekly-stock-checks", "manage");
  if (access.response) return access.response;
  let draft;
  try { draft = await readSmallJson(request, 65536); }
  catch { return json({ error: "Invalid stock check." }, 400); }
  if (!draft || typeof draft.branch !== "string" || typeof draft.employee !== "string" || draft.employee.length > 150 || typeof draft.week !== "string" || typeof draft.notes !== "string" || draft.notes.length > 2000 || !Array.isArray(draft.items) || draft.items.length > 200 || draft.items.some(item => !item || typeof item.product !== "string" || item.product.length > 160 || !["string", "number"].includes(typeof item.quantity)))
    return json({ error: "Enter valid stock check details." }, 400);
  try {
    const db = await getDatabase();
    const branch = await db.collection("branches").findOne({ name: draft.branch, removed: { $ne: true } });
    if (!branch || (access.user.role !== "Admin" && String(branch._id) !== access.user.branchId))
      return json({ error: "Select your assigned active branch." }, 403);
    const error = validateStockCheck(draft, stockCheckBranchNames([branch], draft.week), []);
    if (error) return json({ error }, 400);
    const collection = db.collection("weekly_stock_checks");
    await collection.createIndex({ branchId: 1, week: 1 }, { unique: true });
    const record = { branchId: String(branch._id), branch: branch.name, employee: access.user.role === "Employee" ? access.user.name : draft.employee.trim(), week: draft.week, notes: draft.notes.trim(), items: draft.items.map(item => ({ product: item.product.trim(), quantity: Number(item.quantity) })), submittedBy: new ObjectId(access.user.id), recordedAt: new Date().toISOString() };
    const result = await collection.insertOne(record);
    return json({ check: output({ ...record, _id: result.insertedId }) }, 201);
  } catch (error) { return json({ error: error.code === 11000 ? "This branch already has a stock check for that week." : "Stock check could not be saved." }, error.code === 11000 ? 409 : 503); }
}
