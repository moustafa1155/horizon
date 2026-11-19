import { currentUser, json } from "lib/serverAuth";
import { allows } from "lib/authCore.mjs";
import { getDatabase } from "lib/mongodb";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Please sign in." }, 401);
    if (!allows(user, "weekly-orders") && !allows(user, "weekly-stock-checks")) return json({ error: "Product access unavailable." }, 403);
    const records = await (await getDatabase()).collection("products").find({ removed: { $ne: true } }, { projection: { name: 1, category: 1 } }).collation({ locale: "en", strength: 2, numericOrdering: true }).sort({ name: 1 }).limit(5000).toArray();
    return json({ products: records.map(({ _id, name, category }) => ({ id: String(_id), name, category })) });
  } catch { return json({ error: "Product list could not be loaded." }, 503); }
}
