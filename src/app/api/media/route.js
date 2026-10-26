import { randomUUID } from "node:crypto";
import { authorize, json } from "lib/serverAuth";
import { getDatabase } from "lib/mongodb";
import { createBunnyStorage } from "lib/bunnyStorage.mjs";
import { readMediaBody, prepareMedia } from "lib/mediaUpload.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function admin(request, action = "view") {
  const access = await authorize(request, "default", action);
  if (access.response) return access;
  if (access.user.role !== "Admin")
    return { response: json({ error: "Only admins can manage media." }, 403) };
  return access;
}
export async function GET(request) {
  const access = await admin(request);
  if (access.response) return access.response;
  try {
    const rows = await (
      await getDatabase()
    )
      .collection("media_files")
      .find(
        { removed: { $ne: true } },
        { projection: { name: 1, contentType: 1, size: 1, createdAt: 1 } }
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return json({
      files: rows.map(({ _id, ...row }) => ({
        ...row,
        id: String(_id),
        url: "/api/media/" + _id + "/file",
      })),
    });
  } catch {
    return json({ error: "Media library could not be loaded." }, 503);
  }
}
export async function POST(request) {
  const access = await admin(request, "manage");
  if (access.response) return access.response;
  let storage;
  try {
    storage = createBunnyStorage();
  } catch (error) {
    return json({ error: error.message }, 503);
  }
  let prepared, name;
  try {
    const type = (request.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const bytes = await readMediaBody(request);
    prepared = await prepareMedia(bytes, type);
    name =
      decodeURIComponent(request.headers.get("x-file-name") || "media")
        .replace(/[\/\x00-\x1f\x7f]/g, "")
        .slice(0, 160)
        .trim() || "media";
    name = name.replace(/\.[^.]+$/, "") + "." + prepared.extension;
  } catch (error) {
    return json(
      { error: error.message || "Invalid media file." },
      error.status || 400
    );
  }
  const storagePath = "portal-media/" + randomUUID() + "." + prepared.extension;
  try {
    await storage.put(storagePath, prepared.data, prepared.contentType);
  } catch (error) {
    return json({ error: error.message }, 503);
  }
  try {
    const record = {
      name,
      storagePath,
      provider: "bunny",
      contentType: prepared.contentType,
      size: prepared.data.length,
      uploadedBy: access.user.id,
      createdAt: new Date(),
    };
    const result = await (await getDatabase())
      .collection("media_files")
      .insertOne(record);
    return json(
      {
        file: {
          id: String(result.insertedId),
          name,
          contentType: record.contentType,
          size: record.size,
          createdAt: record.createdAt,
          url: "/api/media/" + result.insertedId + "/file",
        },
      },
      201
    );
  } catch {
    try {
      await storage.remove(storagePath);
    } catch {}
    return json(
      {
        error: "The media library record could not be saved. Please try again.",
      },
      503
    );
  }
}
