import { currentUser, json } from "lib/serverAuth";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    return json({ user }, user ? 200 : 401);
  } catch {
    return json({ error: "Authentication service unavailable." }, 503);
  }
}
