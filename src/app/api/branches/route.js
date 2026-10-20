import { currentUser, json } from "lib/serverAuth";
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
              { _id: user.branchId || "__unassigned__" },
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
        projection: { name: 1, type: 1, startDate: 1, endDate: 1, removed: 1 },
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
