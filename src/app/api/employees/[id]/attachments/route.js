import { randomUUID } from "node:crypto";
import { json } from "lib/serverAuth";
import { createBunnyStorage } from "lib/bunnyStorage.mjs";
import { readMediaBody } from "lib/mediaUpload.mjs";
import {
  employeeAttachmentAccess,
  publicAttachment,
} from "lib/employeeAttachmentAccess";
import { validateEmployeeAttachment } from "lib/employeeAttachmentFile.mjs";
import { attachmentNameError } from "../../../../../data/employeeAttachments.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, context) {
  const access = await employeeAttachmentAccess(request, context);
  if (access.response) return access.response;
  try {
    const rows = await access.db
      .collection("employee_attachments")
      .find(
        { employeeId: access.employeeId, removed: { $ne: true } },
        {
          projection: {
            name: 1,
            originalName: 1,
            size: 1,
            createdAt: 1,
            employeeId: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return json({ files: rows.map(publicAttachment) });
  } catch {
    return json({ error: "Employee files could not be loaded." }, 503);
  }
}
export async function POST(request, context) {
  const access = await employeeAttachmentAccess(request, context, "manage");
  if (access.response) return access.response;
  let name, originalName, data, details;
  try {
    name = decodeURIComponent(
      request.headers.get("x-attachment-name") || ""
    ).trim();
    originalName = decodeURIComponent(request.headers.get("x-file-name") || "");
    const error = attachmentNameError(name);
    if (error) return json({ error }, 400);
    data = await readMediaBody(request);
    details = validateEmployeeAttachment(data, originalName);
  } catch (error) {
    return json(
      { error: error.message || "Invalid employee file." },
      error.status || 400
    );
  }
  let storage;
  try {
    storage = createBunnyStorage();
  } catch (error) {
    return json({ error: error.message }, 503);
  }
  const storagePath =
    "portal-media/employee-attachments/" +
    randomUUID() +
    "." +
    details.extension;
  try {
    await storage.put(storagePath, data, details.contentType);
  } catch (error) {
    return json({ error: error.message }, 503);
  }
  try {
    const record = {
      employeeId: access.employeeId,
      name,
      originalName,
      contentType: details.contentType,
      size: data.length,
      storagePath,
      provider: "bunny",
      uploadedBy: access.user.id,
      createdAt: new Date(),
    };
    const result = await access.db
      .collection("employee_attachments")
      .insertOne(record);
    return json(
      { file: publicAttachment({ ...record, _id: result.insertedId }) },
      201
    );
  } catch {
    try {
      await storage.remove(storagePath);
    } catch {}
    return json(
      { error: "Employee file could not be saved. Please try again." },
      503
    );
  }
}
