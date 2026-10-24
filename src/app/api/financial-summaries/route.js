import { ObjectId } from "mongodb";
import { authorize, json } from "lib/serverAuth";
import { getDatabase } from "lib/mongodb";
import { readSmallJson } from "lib/requestSecurity.mjs";
import {
  validFinancialValues,
  validFinancialWeek,
  FINANCIAL_FIELDS,
} from "../../../data/financialSummary.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function admin(request) {
  const access = await authorize(request, "default");
  if (access.response) return access;
  if (access.user.role !== "Admin")
    return {
      response: json(
        { error: "Only admins can access financial summaries." },
        403
      ),
    };
  return access;
}
const validBranchId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(id);
async function findBranch(db, id) {
  return db
    .collection("branches")
    .findOne({
      $or: [
        { _id: id },
        ...(/^[a-f0-9]{24}$/i.test(id) ? [{ _id: new ObjectId(id) }] : []),
      ],
    });
}
function publicSummary(row) {
  if (!row) return null;
  return {
    branchId: row.branchId,
    branchName: row.branchName,
    week: row.week,
    revision: row.revision,
    updatedAt: row.updatedAt,
    source: row.source
      ? {
          file: row.source.file,
          sheet: row.source.sheet,
          range: row.source.range,
        }
      : null,
    ...Object.fromEntries(
      FINANCIAL_FIELDS.map(([key]) => [key, row[key] ?? null])
    ),
  };
}
async function collection(db) {
  if (!globalThis.financialIndex)
    globalThis.financialIndex = db
      .collection("weekly_financial_summaries")
      .createIndex(
        { branchId: 1, week: 1 },
        { unique: true, name: "financial_branch_week" }
      )
      .catch((e) => {
        delete globalThis.financialIndex;
        throw e;
      });
  await globalThis.financialIndex;
  return db.collection("weekly_financial_summaries");
}
export async function GET(request) {
  const access = await admin(request);
  if (access.response) return access.response;
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");
  const week = url.searchParams.get("week");
  if (!validBranchId(branchId) || !validFinancialWeek(week))
    return json({ error: "Select a valid branch and week." }, 400);
  try {
    const db = await getDatabase();
    if (!(await findBranch(db, branchId)))
      return json(
        { error: "This branch is not available in the database." },
        404
      );
    return json({
      summary: publicSummary(
        await (await collection(db)).findOne({ branchId, week })
      ),
    });
  } catch {
    return json({ error: "Financial summary could not be loaded." }, 503);
  }
}
export async function PUT(request) {
  const access = await admin(request);
  if (access.response) return access.response;
  let body;
  try {
    body = await readSmallJson(request);
  } catch {
    return json({ error: "Invalid financial summary." }, 400);
  }
  if (
    !validBranchId(body?.branchId) ||
    !validFinancialWeek(body?.week) ||
    !Number.isSafeInteger(body?.revision) ||
    body.revision < 0 ||
    !validFinancialValues(body?.values)
  )
    return json(
      { error: "Enter valid amounts and select a branch and week." },
      400
    );
  try {
    const db = await getDatabase();
    const branch = await findBranch(db, body.branchId);
    if (!branch)
      return json(
        { error: "This branch is not available in the database." },
        404
      );
    const reports = await collection(db);
    const record = {
      branchId: body.branchId,
      branchName: branch.name,
      week: body.week,
      ...Object.fromEntries(
        FINANCIAL_FIELDS.map(([key]) => [key, body.values[key]])
      ),
      updatedAt: new Date(),
      updatedBy: access.user.id,
    };
    let saved;
    if (body.revision === 0) {
      saved = { ...record, revision: 1, createdAt: new Date() };
      await reports.insertOne(saved);
    } else {
      saved = await reports.findOneAndUpdate(
        { branchId: body.branchId, week: body.week, revision: body.revision },
        { $set: record, $inc: { revision: 1 } },
        { returnDocument: "after" }
      );
      if (!saved)
        return json(
          {
            error:
              "These figures changed in another session. Reload them before saving.",
          },
          409
        );
    }
    return json({ summary: publicSummary(saved) });
  } catch (error) {
    return json(
      {
        error:
          error.code === 11000
            ? "These figures changed in another session. Reload them before saving."
            : "Financial summary could not be saved.",
      },
      error.code === 11000 ? 409 : 503
    );
  }
}
