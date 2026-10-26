import "server-only";
import { ObjectId } from "mongodb";
import { authorize, json } from "./serverAuth";
import { branchFilter } from "./authCore.mjs";
import { getDatabase } from "./mongodb";
export async function employeeAttachmentAccess(
  request,
  context,
  action = "view"
) {
  const access = await authorize(request, "employees", action);
  if (access.response) return access;
  const params = await context.params;
  const id = params.id;
  if (!/^[a-f0-9]{24}$/i.test(id || ""))
    return { response: json({ error: "Invalid employee identifier." }, 400) };
  try {
    const db = await getDatabase();
    const employee = await db
      .collection("employees")
      .findOne(
        {
          _id: new ObjectId(id),
          ...branchFilter(access.user),
          removed: { $ne: true },
        },
        { projection: { _id: 1 } }
      );
    if (!employee)
      return { response: json({ error: "Employee not found." }, 404) };
    return { ...access, db, employeeId: String(employee._id), params };
  } catch {
    return {
      response: json({ error: "Employee files could not be loaded." }, 503),
    };
  }
}
export function publicAttachment(record) {
  const id = String(record._id);
  return {
    id,
    name: record.name,
    originalName: record.originalName,
    size: record.size,
    createdAt: record.createdAt,
    url: "/api/employees/" + record.employeeId + "/attachments/" + id + "/file",
  };
}
