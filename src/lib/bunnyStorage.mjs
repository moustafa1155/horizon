const HOSTS = new Set([
  "storage.bunnycdn.com",
  ...["uk", "ny", "la", "sg", "se", "br", "jh", "syd"].map(
    (region) => region + ".storage.bunnycdn.com"
  ),
]);
export function createBunnyStorage(environment = process.env, fetcher = fetch) {
  const host = environment.BUNNY_STORAGE_HOST || "storage.bunnycdn.com";
  const zone = environment.BUNNY_STORAGE_ZONE;
  const password = environment.BUNNY_STORAGE_PASSWORD;
  if (
    !HOSTS.has(host) ||
    typeof zone !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(zone) ||
    !password
  )
    throw Error("Media storage is not configured. Contact your administrator.");
  function url(path) {
    if (
      typeof path !== "string" ||
      !path.startsWith("portal-media/") ||
      path
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            !/^[a-zA-Z0-9_.-]+$/.test(part)
        )
    )
      throw Error("Invalid media storage path.");
    return (
      "https://" +
      host +
      "/" +
      zone +
      "/" +
      path.split("/").map(encodeURIComponent).join("/")
    );
  }
  async function call(path, options = {}) {
    try {
      return await fetcher(url(path), {
        ...options,
        headers: {
          "Accept-Encoding": "identity",
          ...options.headers,
          AccessKey: password,
        },
        redirect: "error",
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw Error("Media storage could not be reached. Please try again.");
    }
  }
  return {
    async put(path, data, contentType) {
      const response = await call(path, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: data,
      });
      await response.body?.cancel();
      if (!response.ok)
        throw Error(
          "Media upload to storage failed. Check the storage settings."
        );
    },
    async get(path, range) {
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))
        throw Error("Invalid media range.");
      const response = await call(path, {
        headers: range ? { Range: range } : {},
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw Error("The media file could not be loaded.");
      }
      return response;
    },
    async remove(path) {
      const response = await call(path, { method: "DELETE" });
      await response.body?.cancel();
      if (!response.ok && response.status !== 404)
        throw Error("Storage cleanup failed.");
    },
  };
}
