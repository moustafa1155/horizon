import { authorize } from "lib/serverAuth";
import { getDatabase } from "lib/mongodb";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const access = await authorize(request, "default");
  if (access.response) return access.response;
  try {
    const records = await (
      await getDatabase()
    )
      .collection("weekly_sales_reports")
      .find(
        {},
        {
          projection: {
            branch: 1,
            week: 1,
            cashCents: 1,
            cardCents: 1,
            sourceCostCents: 1,
            notes: 1,
            manager: 1,
            savedAt: 1,
            daily: 1,
          },
        }
      )
      .sort({ week: -1 })
      .toArray();
    return Response.json(
      {
        reports: records.map(({ _id, ...r }) => ({ ...r, id: _id.toString() })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Imported sales could not be loaded." },
      { status: 503 }
    );
  }
}
