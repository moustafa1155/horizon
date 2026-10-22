import { readSmallJson } from "lib/requestSecurity.mjs";
import { authorize } from "lib/serverAuth";
import { branchFilter } from "lib/authCore.mjs";
import { ObjectId, Binary } from "mongodb";
import {
  prepareProfilePhoto,
  EMPLOYEE_REQUEST_BYTES,
} from "lib/profilePhotoServer.mjs";
import { employeeCollection } from "lib/mongodb";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function employeeSummary(record, id) {
  const { profilePhoto, ...fields } = record;
  return {
    ...fields,
    id,
    profilePhotoUrl: profilePhoto?.updatedAt
      ? "/api/employees/" +
        id +
        "/photo?v=" +
        new Date(profilePhoto.updatedAt).getTime()
      : null,
  };
}
export async function GET(request) {
  const access = await authorize(request, "employees");
  if (access.response) return access.response;
  try {
    const collection = await employeeCollection();
    const records = await collection
      .find(
        { ...branchFilter(access.user), removed: { $ne: true } },
        {
          projection: {
            fullName: 1,
            phoneNumber: 1,
            nationalInsuranceNumber: 1,
            email: 1,
            isSample: 1,
            branchId: 1,
            "profilePhoto.updatedAt": 1,
          },
        }
      )
      .sort({ fullName: 1 })
      .limit(1000)
      .toArray();
    return json({
      employees: records.map(({ _id, ...record }) =>
        employeeSummary(record, _id.toString())
      ),
    });
  } catch {
    return json(
      { error: "Employees could not be loaded from the database." },
      503
    );
  }
}
export async function POST(request) {
  return saveEmployee(request, false);
}
export async function PUT(request) {
  return saveEmployee(request, true);
}
async function saveEmployee(request, editing) {
  const access = await authorize(request, "employees", "manage");
  if (access.response) return access.response;
  try {
    if (!request.headers.get("content-type")?.includes("application/json"))
      return json({ error: "Expected employee details as JSON." }, 400);
    let body;
    try {
      body = await readSmallJson(request, EMPLOYEE_REQUEST_BYTES);
    } catch {
      return json({ error: "Invalid employee details." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ error: "Invalid employee details." }, 400);
    if (editing && !/^[a-f0-9]{24}$/i.test(body.id || ""))
      return json({ error: "Invalid employee identifier." }, 400);
    const limits = {
      fullName: 150,
      phoneNumber: 40,
      nationalInsuranceNumber: 20,
      email: 254,
    };
    const record = {};
    for (const [key, max] of Object.entries(limits)) {
      if (
        typeof body[key] !== "string" ||
        !body[key].trim() ||
        body[key].trim().length > max
      )
        return json({ error: "Enter valid details for all four fields." }, 400);
      record[key] = body[key].trim();
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email))
      return json({ error: "Enter a valid email address." }, 400);
    record.email = record.email.toLowerCase();
    record.nationalInsuranceNumber = record.nationalInsuranceNumber
      .replace(/\s/g, "")
      .toUpperCase();
    if (!record.nationalInsuranceNumber)
      return json({ error: "Enter a National Insurance number." }, 400);
    if (body.branchId !== undefined) {
      if (typeof body.branchId !== "string" || body.branchId.length > 120)
        return json({ error: "Invalid branch assignment." }, 400);
      record.branchId = body.branchId;
    }
    if (access.user.role === "Branch Manager") {
      if (!editing) return json({ error: "Only admins can add staff." }, 403);
      delete record.branchId;
    }
    if (access.user.role === "Admin" && record.branchId) {
      const { getDatabase } = await import("lib/mongodb");
      const branch = await (await getDatabase())
        .collection("branches")
        .findOne({
          $or: [
            { _id: record.branchId },
            ...(/^[a-f0-9]{24}$/.test(record.branchId)
              ? [{ _id: new ObjectId(record.branchId) }]
              : []),
          ],
          removed: { $ne: true },
        });
      if (!branch) return json({ error: "Select an active branch." }, 400);
    }
    const removePhoto = body.profilePhoto === null;
    if (body.profilePhoto !== undefined && !removePhoto) {
      try {
        const photo = await prepareProfilePhoto(body.profilePhoto);
        record.profilePhoto = { ...photo, data: new Binary(photo.data) };
      } catch (error) {
        return json({ error: error.message }, 400);
      }
    }
    const collection = await employeeCollection();
    const now = new Date();
    if (editing) {
      const result = await collection.updateOne(
        {
          _id: new ObjectId(body.id),
          ...branchFilter(access.user),
          removed: { $ne: true },
        },
        {
          $set: { ...record, updatedAt: now },
          ...(removePhoto ? { $unset: { profilePhoto: "" } } : {}),
        }
      );
      if (!result.matchedCount)
        return json({ error: "Employee no longer exists." }, 404);
      return json({ employee: employeeSummary(record, body.id) });
    }
    const result = await collection.insertOne({
      ...record,
      createdAt: now,
      updatedAt: now,
    });
    return json(
      { employee: employeeSummary(record, result.insertedId.toString()) },
      201
    );
  } catch (error) {
    return json(
      {
        error:
          error.code === 11000
            ? "An employee with this email or National Insurance number already exists."
            : "The employee could not be saved. Please try again.",
      },
      error.code === 11000 ? 409 : 503
    );
  }
}

export async function DELETE(request) {
  const access = await authorize(request, "employees", "manage");
  if (access.response) return access.response;
  if (access.user.role !== "Admin")
    return json({ error: "Only admins can remove employees." }, 403);
  let body;
  try {
    body = await readSmallJson(request);
  } catch {
    return json({ error: "Invalid removal request." }, 400);
  }
  if (typeof body?.id !== "string" || !/^[a-f0-9]{24}$/i.test(body.id))
    return json({ error: "Invalid employee identifier." }, 400);
  if (body.confirmed !== true)
    return json(
      { error: "Confirm that you want to remove this employee." },
      400
    );
  try {
    const now = new Date();
    const result = await (
      await employeeCollection()
    ).updateOne(
      { _id: new ObjectId(body.id), removed: { $ne: true } },
      {
        $set: {
          removed: true,
          removedAt: now,
          removedBy: access.user.id,
          updatedAt: now,
        },
      }
    );
    if (!result.matchedCount)
      return json(
        { error: "Employee no longer exists or has already been removed." },
        404
      );
    return json({ ok: true });
  } catch {
    return json(
      { error: "The employee could not be removed. Please try again." },
      503
    );
  }
}
