import { ObjectId } from "mongodb";
import { authorize, json } from "lib/serverAuth";
import { getDatabase } from "lib/mongodb";
import { branchFilter } from "lib/authCore.mjs";
import { readSmallJson } from "lib/requestSecurity.mjs";
import { validateShifts } from "../../../views/admin/staffTimetables/timetableHelpers.mjs";
import { validWeek } from "lib/timetableWeek.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const access = await authorize(request, "employees");
  if (access.response) return access.response;
  try {
    const db = await getDatabase();
    const employees = await db.collection("employees").find({ ...branchFilter(access.user), removed: { $ne: true } }, { projection: { _id: 1 } }).toArray();
    const timetables = await db.collection("weekly_staff_timetables").find({ employeeId: { $in: employees.map(row => String(row._id)) } }).toArray();
    return json({ timetables: timetables.map(({ employeeId, week, rows, revision }) => ({ employeeId, week, rows, revision })) });
  } catch { return json({ error: "Timetables could not be loaded." }, 503); }
}
export async function PUT(request) {
  const access = await authorize(request, "weekly-staff-timetables", "manage");
  if (access.response) return access.response;
  let body;
  try { body = await readSmallJson(request, 65536); } catch { return json({ error: "Invalid timetable." }, 400); }
  if (!body || !/^[a-f0-9]{24}$/.test(body.employeeId || "") || !validWeek(body.week) || !Number.isSafeInteger(body.revision) || body.revision < 0 || !Array.isArray(body.rows) || body.rows.length > 100 || body.rows.some(row => !row || typeof row.id !== "string" || !row.id || row.id.length > 120 || typeof row.start !== "string" || typeof row.end !== "string" || !["number","string"].includes(typeof row.day) || !["number","string"].includes(typeof row.breakMinutes)) || new Set(body.rows.map(row => row.id)).size !== body.rows.length) return json({ error: "Invalid timetable details." }, 400);
  const validation = validateShifts(body.rows);
  if (validation) return json({ error: validation }, 400);
  try {
    const db = await getDatabase();
    const collection = db.collection("weekly_staff_timetables");
    await collection.createIndex({ employeeId: 1, week: 1 }, { unique: true });
    const session = db.client.startSession();
    let result;
    try {
      result = await session.withTransaction(async () => {
        const options = { session };
        const employee = await db.collection("employees").updateOne({ _id: new ObjectId(body.employeeId), ...branchFilter(access.user), removed: { $ne: true } }, { $inc: { timetableVersion: 1 } }, options);
        if (!employee.matchedCount) { const error = Error("Employee is unavailable or outside your branch."); error.status = 404; throw error; }
        const query = { employeeId: body.employeeId, week: body.week };
        const existing = await collection.findOne(query, options);
        if ((existing?.revision || 0) !== body.revision) { const error = Error("This timetable changed. Reload before saving again."); error.status = 409; throw error; }
        const record = { ...query, rows: body.rows.map(row => ({ id: row.id, employeeId: body.employeeId, week: body.week, day: Number(row.day), start: row.start, end: row.end, breakMinutes: Number(row.breakMinutes) })), revision: body.revision + 1, updatedAt: new Date(), updatedBy: access.user.id };
        if (existing) await collection.updateOne({ _id: existing._id }, { $set: record }, options);
        else await collection.insertOne(record, options);
        return { employeeId: record.employeeId, week: record.week, rows: record.rows, revision: record.revision };
      });
    } finally { await session.endSession(); }
    return json({ timetable: result });
  } catch (error) { return json({ error: error.status ? error.message : "Timetable could not be saved." }, error.status || (error.code === 11000 ? 409 : 503)); }
}
