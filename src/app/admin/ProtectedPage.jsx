import { currentUser } from "lib/serverAuth";
import { allows } from "lib/authCore.mjs";
import { firstPage } from "../../data/userHelpers.mjs";
import { redirect } from "next/navigation";
import ClientShell from "../ClientShell";
export default async function ProtectedPage({ page }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (page && !allows(user, page)) redirect("/admin/" + firstPage(user));
  return <ClientShell />;
}
