import "server-only";
import { authorize, json } from "./serverAuth";
import { getDatabase } from "./mongodb";
import { readSmallJson } from "./requestSecurity.mjs";
import { branchFilter } from "./authCore.mjs";
import { stockCheckBranchNames } from "../views/admin/weeklyStockChecks/stockCheckHelpers.mjs";
import { validateOrder } from "../views/admin/weeklyOrders/orderHelpers.mjs";
import { validateReport, toCents } from "../views/admin/weeklySalesReports/salesHelpers.mjs";
export function weeklyHandlers(sales) {
  const page = sales ? "weekly-sales-reports" : "weekly-orders";
  const collectionName = sales ? "weekly_sales_reports" : "weekly_orders";
  const key = sales ? "reports" : "orders";
  const output = ({ _id, submittedBy, ...record }) => ({ ...record, id: String(_id) });
  return {
    async GET(request) {
      const access = await authorize(request, page);
      if (access.response) return access.response;
      if (sales && access.user.role !== "Admin") return json({ error: "Sales history is available to admins only." }, 403);
      try {
        const records = await (await getDatabase()).collection(collectionName).find(branchFilter(access.user)).sort({ week: -1 }).limit(5000).toArray();
        return json({ [key]: records.map(output) });
      } catch { return json({ error: "Records could not be loaded." }, 503); }
    },
    async POST(request) {
      const access = await authorize(request, page, "manage");
      if (access.response) return access.response;
      let draft;
      try { draft = await readSmallJson(request, 65536); } catch { return json({ error: "Invalid entry." }, 400); }
      if (!draft || typeof draft.branch !== "string" || typeof draft.manager !== "string" || draft.manager.length > 150 || typeof draft.week !== "string" || typeof draft.notes !== "string" || draft.notes.length > 2000 || (sales ? ![draft.card,draft.cash].every(v => typeof v === "string" || typeof v === "number") : !Array.isArray(draft.items) || draft.items.length > 200 || draft.items.some(item => !item || typeof item.product !== "string" || item.product.length > 160 || !["string","number"].includes(typeof item.quantity)))) return json({ error: "Enter valid details." }, 400);
      try {
        const db = await getDatabase();
        const branch = await db.collection("branches").findOne({ name: draft.branch, removed: { $ne: true } });
        if (!branch || (access.user.role !== "Admin" && String(branch._id) !== access.user.branchId)) return json({ error: "Select your assigned active branch." }, 403);
        const validation = (sales ? validateReport : validateOrder)(draft, stockCheckBranchNames([branch], draft.week), []);
        if (validation) return json({ error: validation }, 400);
        const collection = db.collection(collectionName);
        await collection.createIndex({ branch: 1, week: 1 }, { unique: true, name: "branch_week_unique" });
        await collection.createIndex({ branchId: 1, week: 1 }, { unique: true, partialFilterExpression: { branchId: { $type: "string" } }, name: "branch_id_week_unique" });
        if (await collection.findOne({ week: draft.week, $or: [{ branchId: String(branch._id) }, { branch: branch.name }] })) return json({ error: "This branch already has a record for that week." }, 409);
        const record = { branchId: String(branch._id), branch: branch.name, week: draft.week, manager: access.user.role === "Branch Manager" ? access.user.name : draft.manager.trim(), notes: draft.notes.trim(), submittedBy: access.user.id,
          ...(sales ? { cardCents: toCents(draft.card), cashCents: toCents(draft.cash), savedAt: new Date().toISOString() } : { items: draft.items.map(item => ({ product: item.product.trim(), quantity: Number(item.quantity) })), placedAt: new Date().toISOString() }) };
        const result = await collection.insertOne(record);
        return json({ [sales ? "report" : "order"]: output({ ...record, _id: result.insertedId }) }, 201);
      } catch (error) { return json({ error: error.code === 11000 ? "This branch already has a record for that week." : "Record could not be saved." }, error.code === 11000 ? 409 : 503); }
    },
  };
}
