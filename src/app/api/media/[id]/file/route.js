import { ObjectId } from "mongodb";
import { authorize, json } from "lib/serverAuth";
import { getDatabase } from "lib/mongodb";
import { createBunnyStorage } from "lib/bunnyStorage.mjs";
import { MEDIA_TYPES } from "../../../../../data/mediaFiles.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, context) {
  const access = await authorize(request, "default");
  if (access.response) return access.response;
  if (access.user.role !== "Admin")
    return json({ error: "Access unavailable." }, 403);
  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(id))
    return json({ error: "Invalid media identifier." }, 400);
  const range = request.headers.get("range");
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))
    return json({ error: "Invalid media range." }, 416);
  try {
    const record = await (await getDatabase())
      .collection("media_files")
      .findOne({ _id: new ObjectId(id), removed: { $ne: true } });
    if (!record || !MEDIA_TYPES.includes(record.contentType))
      return json({ error: "Media not found." }, 404);
    const upstream = await createBunnyStorage().get(record.storagePath, range);
    const headers = {
      "Content-Type": record.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition":
        "inline; filename*=UTF-8''" +
        encodeURIComponent(record.name).replace(/'/g, "%27"),
    };
    for (const name of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return json({ error: "The media file could not be loaded." }, 503);
  }
}
