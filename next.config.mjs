import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
export default {
  reactStrictMode: true,
  turbopack: { root },
  env: {
    NEXT_PUBLIC_HOSTED_PREVIEW:
      process.env.NEXT_PUBLIC_HOSTED_PREVIEW || "true",
  },
};
