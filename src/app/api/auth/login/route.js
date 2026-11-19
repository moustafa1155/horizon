import { signIn } from "lib/signIn";
export const runtime = "nodejs";
export function POST(request) { return signIn(request); }
