import { ObjectId } from "mongodb";
import { json } from "lib/serverAuth";
import { employeeAttachmentAccess } from "lib/employeeAttachmentAccess";
import { createBunnyStorage } from "lib/bunnyStorage.mjs";
import { attachmentDownloadName } from "../../../../../../../data/employeeAttachments.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, context) {
  const access = await employeeAttachmentAccess(request, context);
  if (access.response) return access.response;
  const id = access.params.attachmentId;
  if (!/^[a-f0-9]{24}$/i.test(id || ""))
    return json({ error: "Invalid file identifier." }, 400);
  try {
    const file = await access.db
      .collection("employee_attachments")
      .findOne({
        _id: new ObjectId(id),
        employeeId: access.employeeId,
        removed: { $ne: true },
      });
    if (!file) return json({ error: "Employee file not found." }, 404);
    const upstream = await createBunnyStorage().get(file.storagePath);
    const name = attachmentDownloadName(file.name, file.originalName);
    const headers = {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition":
        "attachment; filename*=UTF-8''" +
        encodeURIComponent(name).replace(
          /['()*]/g,
          (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase()
        ),
    };
    const length = upstream.headers.get("content-length");
    if (length) headers["Content-Length"] = length;
    return new Response(upstream.body, { headers });
  } catch {
    return json({ error: "Employee file could not be downloaded." }, 503);
  }
}
