import { weeklyHandlers } from "lib/weeklyRecords";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST } = weeklyHandlers(false);
