import { ObjectId, Binary } from "mongodb";
import { authorize, json } from "lib/serverAuth";
import { branchFilter } from "lib/authCore.mjs";
import { employeeCollection } from "lib/mongodb";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, context) {
  const access = await authorize(request, "employees");
  if (access.response) return access.response;
  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(id))
    return json({ error: "Invalid employee identifier." }, 400);
  try {
    const employee = await (
      await employeeCollection()
    ).findOne(
      {
        _id: new ObjectId(id),
        ...branchFilter(access.user),
        removed: { $ne: true },
      },
      { projection: { profilePhoto: 1 } }
    );
    const photo = employee?.profilePhoto;
    if (!photo?.data || photo.contentType !== "image/webp")
      return json({ error: "Profile picture not found." }, 404);
    const data = photo.data instanceof Binary ? photo.data.buffer : photo.data;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return json({ error: "Profile picture could not be loaded." }, 503);
  }
}
