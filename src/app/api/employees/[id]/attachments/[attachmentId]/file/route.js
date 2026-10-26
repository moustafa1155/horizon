import { ObjectId } from "mongodb";
import { json } from "lib/serverAuth";
import { employeeAttachmentAccess } from "lib/employeeAttachmentAccess";
import { createBunnyStorage } from "lib/bunnyStorage.mjs";
import {
  attachmentDownloadName,
  attachmentExtension,
  ATTACHMENT_TYPES,
} from "../../../../../../../data/employeeAttachments.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, context) {
  const access = await employeeAttachmentAccess(request, context);
  if (access.response) return access.response;
  const id = access.params.attachmentId;
  if (!/^[a-f0-9]{24}$/i.test(id || ""))
    return json({ error: "Invalid file identifier." }, 400);
  try {
    const file = await access.db.collection("employee_attachments").findOne({
      _id: new ObjectId(id),
      employeeId: access.employeeId,
      removed: { $ne: true },
    });
    if (!file) return json({ error: "Employee file not found." }, 404);
    const range = request.headers.get("range");
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))
      return json({ error: "Invalid file range." }, 416);
    const upstream = await createBunnyStorage().get(file.storagePath, range);
    const name = attachmentDownloadName(file.name, file.originalName);
    const extension = attachmentExtension(file.originalName);
    const preview =
      new URL(request.url).searchParams.get("preview") === "1" &&
      [
        "pdf",
        "jpg",
        "jpeg",
        "png",
        "webp",
        "mp4",
        "webm",
        "mp3",
        "wav",
        "ogg",
      ].includes(extension);
    const headers = {
      "Content-Type": preview
        ? ATTACHMENT_TYPES[extension]
        : "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition":
        (preview
          ? "inline; filename*=UTF-8''"
          : "attachment; filename*=UTF-8''") +
        encodeURIComponent(name).replace(
          /['()*]/g,
          (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase()
        ),
    };
    const length = upstream.headers.get("content-length");
    if (length) headers["Content-Length"] = length;
    for (const key of ["content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key);
      if (value) headers[key] = value;
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return json({ error: "Employee file could not be downloaded." }, 503);
  }
}
